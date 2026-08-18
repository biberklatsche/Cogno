import {
  PtyChunkContract,
  PtyExitEventContract,
  PtyOutputListenerContract,
  PtySpawnHandleContract,
  PtySpawnOptionsContract,
  PtySpawnResultContract,
  PtyTransportPort,
} from "@cogno/core-api";
import { invoke, SERIALIZE_TO_IPC_FN, transformCallback } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ProcessDetails = {
  processId: number;
  parentProcessId: number | null;
  name: string;
  command: string[];
  executablePath: string | null;
  currentWorkingDirectory: string | null;
  rootDirectory: string | null;
  environment: string[];
  status: string;
  startTimeSeconds: number;
  runTimeSeconds: number;
  cpuUsagePercent: number;
  memoryBytes: number;
  virtualMemoryBytes: number;
  diskReadBytes: number;
  diskWrittenBytes: number;
  totalDiskReadBytes: number;
  totalDiskWrittenBytes: number;
  userId: string | null;
  groupId: string | null;
};

export type ProcessTreeSnapshot = {
  rootProcessId: number;
  directChildProcessIds: number[];
  descendantProcessIds: number[];
  rootProcess: ProcessDetails;
  directChildren: ProcessDetails[];
  descendants: ProcessDetails[];
};

/**
 * How long a missing sequence number may hold back later chunks. Tauri
 * delivers chunks below 1 KiB by direct eval and larger ones through an
 * async fetch, so short reorderings are normal; a chunk still missing after
 * this long was lost in transit and is skipped, so the terminal loses that
 * chunk instead of freezing for good.
 */
export const PTY_CHUNK_GAP_TIMEOUT_MS = 3000;

/** Bytes of sequence-number header (u32 little endian) in front of every chunk. */
const CHUNK_HEADER_LEN = 4;

type ChannelMessage = { message: ArrayBuffer; index: number } | { end: true; index: number };

type TauriInternals = { unregisterCallback(id: number): void } | undefined;

/**
 * Receiving end of the `pty_spawn` data channel (`tauri::ipc::Channel` on
 * the Rust side). Serializes like `Channel` from `@tauri-apps/api/core`, but
 * restores order from the sequence number the reader thread prefixes to each
 * chunk and tolerates lost chunks (see `PTY_CHUNK_GAP_TIMEOUT_MS`), which the
 * stock class does not: one lost message would stall it forever.
 */
export class PtyDataChannel {
  readonly id: number;
  private _nextSeq = 0;
  private _pending = new Map<number, Uint8Array>();
  private _gapTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private _closed = false;

  onmessage: (chunk: PtyChunkContract) => void = () => {};
  /** Chunks `fromSeq` up to (excluding) `toSeq` were given up as lost. */
  onGap: (fromSeq: number, toSeq: number) => void = () => {};

  constructor() {
    this.id = transformCallback((message: ChannelMessage) => this.receive(message));
  }

  /** Stops delivering and releases the callback registration. */
  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.clearGapTimer();
    this._pending.clear();
    (
      window as unknown as { __TAURI_INTERNALS__: TauriInternals }
    ).__TAURI_INTERNALS__?.unregisterCallback(this.id);
  }

  private receive(message: ChannelMessage): void {
    if (this._closed) return;
    if ("end" in message) {
      // The Rust side dropped the channel; nothing more will arrive.
      this.close();
      return;
    }
    const buffer = message.message;
    if (buffer.byteLength < CHUNK_HEADER_LEN) return;
    const seq = new DataView(buffer).getUint32(0, true);
    if (seq < this._nextSeq) return; // late arrival of a chunk already given up
    this._pending.set(seq, new Uint8Array(buffer, CHUNK_HEADER_LEN));
    this.drain();
  }

  private drain(): void {
    while (!this._closed) {
      const data = this._pending.get(this._nextSeq);
      if (!data) break;
      this._pending.delete(this._nextSeq);
      const seq = this._nextSeq++;
      this.onmessage({ seq, data });
    }
    if (this._pending.size === 0) {
      this.clearGapTimer();
    } else if (!this._gapTimer) {
      this._gapTimer = setTimeout(() => {
        this._gapTimer = undefined;
        this.skipGap();
      }, PTY_CHUNK_GAP_TIMEOUT_MS);
    }
  }

  private skipGap(): void {
    if (this._closed || this._pending.size === 0) return;
    const oldestPending = Math.min(...this._pending.keys());
    const fromSeq = this._nextSeq;
    this._nextSeq = oldestPending;
    this.onGap(fromSeq, oldestPending);
    this.drain();
  }

  private clearGapTimer(): void {
    if (this._gapTimer === undefined) return;
    clearTimeout(this._gapTimer);
    this._gapTimer = undefined;
  }

  [SERIALIZE_TO_IPC_FN](): string {
    return `__CHANNEL__:${this.id}`;
  }

  toJSON(): string {
    return this[SERIALIZE_TO_IPC_FN]();
  }
}

/**
 * `PtyTransportPort` over Tauri commands: `pty_spawn` with a `PtyDataChannel`
 * for output, `pty_ack` for flow control, plus the usual write/resize/kill.
 */
export class TauriPtyTransport extends PtyTransportPort {
  spawn(
    options: PtySpawnOptionsContract,
    output: PtyOutputListenerContract,
  ): PtySpawnHandleContract {
    // The channel exists before the reader thread starts, so no output can be
    // lost between spawn and listener registration.
    const channel = new PtyDataChannel();
    channel.onmessage = (chunk) => output.onChunk(chunk);
    channel.onGap = (fromSeq, toSeq) => output.onChunksLost(fromSeq, toSeq);
    const ready = invoke<PtySpawnResultContract>("pty_spawn", {
      options: {
        name: options.terminalId,
        cols: options.cols,
        rows: options.rows,
        profile: options.profile,
        dev_mode: options.devMode,
      },
      onData: channel,
    });
    return {
      ready,
      closeOutput: () => channel.close(),
    };
  }

  ack(terminalId: string, seq: number): Promise<void> {
    return invoke("pty_ack", { terminalId, seq });
  }

  kill(terminalId: string): Promise<void> {
    return invoke("pty_kill", { terminalId });
  }

  resize(terminalId: string, cols: number, rows: number): Promise<void> {
    return invoke("pty_resize", { terminalId, cols, rows });
  }

  onExit(terminalId: string, listener: (event: PtyExitEventContract) => void): Promise<() => void> {
    return listen<PtyExitEventContract>(`pty-exit:${terminalId}`, (event) => {
      listener(event.payload);
    });
  }

  write(terminalId: string, data: string): Promise<void> {
    return invoke("pty_write", { terminalId, data });
  }

  executeLineEditorAction(terminalId: string, action: string, payload?: object): Promise<void> {
    return invoke("pty_execute_line_editor_action", {
      terminalId,
      action,
      payloadJson: payload ? JSON.stringify(payload) : null,
    });
  }
}

/** Process inspection of PTY sessions (not part of the transport port). */
export const TauriPty = {
  getProcessTreeByProcessId(processId: number) {
    return invoke<ProcessTreeSnapshot>("pty_get_process_tree_by_pid", {
      processId,
    });
  },

  getProcessTreeByTerminalId(terminalId: string) {
    return invoke<ProcessTreeSnapshot>("pty_get_process_tree_by_terminal_id", {
      terminalId,
    });
  },
};
