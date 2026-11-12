import { Injectable } from "@angular/core";
import { ShellTypeContract } from "@cogno/shared/domain";
import { invoke, SERIALIZE_TO_IPC_FN, transformCallback } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Shell profile as the backend's spawner expects it (wire format, hence the
 * snake_case keys). Structurally identical to the app's configured profile.
 */
export type PtyShellProfileContract = {
  shell_type: ShellTypeContract;
  path?: string;
  args?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  inject_cogno_cli: boolean;
  enable_shell_integration: boolean;
  load_user_rc: boolean;
};

export type PtySpawnOptionsContract = {
  terminalId: string;
  cols: number;
  rows: number;
  profile: PtyShellProfileContract;
  devMode: boolean;
  /** Whether the shell goes on when Cogno is gone, to be attached to again. */
  survivesClient: boolean;
};

/**
 * Hears what the backend says to this window only. A plain `listen` hears
 * what is said to any window, and another window of this app can show the
 * same terminal: it took the shell over, and what the window that lost it is
 * told must not reach the one that has it now.
 */
function listenInThisWindow<T>(event: string, listener: (payload: T) => void): Promise<() => void> {
  return getCurrentWebviewWindow().listen<T>(event, ({ payload }) => listener(payload));
}

/**
 * A shell was not started because one already runs under its terminal id.
 * That one is never ended for it; the caller can attach to it instead.
 */
export class ShellAlreadyRunsError extends Error {
  constructor(readonly terminalId: string) {
    super(`A shell already runs as terminal ${terminalId}.`);
    this.name = "ShellAlreadyRunsError";
  }
}

/** Why `pty_spawn` did not start a shell (`SpawnError` in the app). */
type SpawnErrorContract = { code: "shellAlreadyRuns" } | { code: "failed"; message: string };

function isSpawnError(error: unknown): error is SpawnErrorContract {
  return typeof error === "object" && error !== null && "code" in error;
}

/** The backend's answer to a start that failed, as an error the caller can tell apart. */
function spawnFailure(error: unknown, terminalId: string): Error {
  if (isSpawnError(error)) {
    return error.code === "shellAlreadyRuns"
      ? new ShellAlreadyRunsError(terminalId)
      : new Error(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Where a shell sits in the Cogno it belongs to. */
export type PtyLabelContract = {
  workspace?: string;
  tab?: string;
  title?: string;
  directory?: string;
};

/** A shell that already runs, and where. */
export type PtyAttachOptionsContract = {
  terminalId: string;
  host?: string;
};

/** One chunk of raw PTY output. `seq` numbers the chunks of a spawn from 0 up. */
export type PtyChunkContract = { seq: number; data: Uint8Array };

export type PtyExitEventContract = { exitCode: number; signal?: number };

export interface PtyOutputListenerContract {
  /** Chunks arrive strictly in sequence order. */
  onChunk(chunk: PtyChunkContract): void;
  /** Chunks `fromSeq` up to (excluding) `toSeq` were lost in transit and skipped. */
  onChunksLost(fromSeq: number, toSeq: number): void;
}

export interface PtySpawnHandleContract {
  /**
   * Resolves once the shell runs (or, for an attach, once it is shown here),
   * rejects when it could not be spawned or is not there to attach to.
   */
  readonly ready: Promise<unknown>;
  /**
   * Stops output delivery for good. Safe to call before `ready` settles;
   * the backend session (if it comes into existence) still has to be killed.
   */
  closeOutput(): void;
}

/** What the process-info panel shows about one process. */
export type ProcessDetails = {
  processId: number;
  parentProcessId: number | null;
  name: string;
  currentWorkingDirectory: string | null;
  status: string;
  runTimeSeconds: number;
  memoryBytes: number;
};

export type ProcessTreeSnapshot = {
  rootProcessId: number;
  rootProcess: ProcessDetails;
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

/**
 * Forward distance from `nextSeq` to `seq` in u32 sequence-number space,
 * wrapping at 2^32 the same way the Rust reader's `seq.wrapping_add(1)`
 * does. A distance at or past half the range means `seq` is actually behind
 * `nextSeq` (already consumed or skipped), not merely far in the future -
 * the standard trick for comparing wrapping counters (e.g. RFC 1982).
 * Plain numeric comparison breaks the instant `nextSeq` wraps past
 * `0xffffffff` while a fresh chunk's `seq` starts back at 0.
 */
function seqDistance(seq: number, nextSeq: number): number {
  return (seq - nextSeq) >>> 0;
}

const U32_HALF_RANGE = 0x8000_0000;

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
    // Late arrival of a chunk already given up. Wraparound-aware: near
    // 0xffffffff -> 0, `seq` can be numerically *smaller* than `_nextSeq`
    // while still being the next one due, so this can't be a plain `<`.
    if (seqDistance(seq, this._nextSeq) >= U32_HALF_RANGE) return;
    this._pending.set(seq, new Uint8Array(buffer, CHUNK_HEADER_LEN));
    this.drain();
  }

  private drain(): void {
    while (!this._closed) {
      const data = this._pending.get(this._nextSeq);
      if (!data) break;
      this._pending.delete(this._nextSeq);
      const seq = this._nextSeq;
      this._nextSeq = (this._nextSeq + 1) >>> 0; // wraps, matching the backend
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
    // The pending entry closest ahead of `_nextSeq` in wraparound order, not
    // necessarily the numerically smallest key once seq numbers have wrapped.
    let oldestPending: number | undefined;
    let oldestDistance = Infinity;
    for (const seq of this._pending.keys()) {
      const distance = seqDistance(seq, this._nextSeq);
      if (distance < oldestDistance) {
        oldestDistance = distance;
        oldestPending = seq;
      }
    }
    if (oldestPending === undefined) return; // unreachable: the size check above guarantees a key
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
 * Transport to the backend's PTY sessions over Tauri commands: `pty_spawn`
 * with a `PtyDataChannel` for output, `pty_ack` for flow control, plus the
 * usual write/resize/kill. Output is pushed through the listener handed to
 * `spawn` (wired before the shell starts, so no byte is lost) and subject
 * to flow control: the reader stops once too much output is unacknowledged,
 * so the consumer must `ack` chunks as it processes them.
 */
@Injectable({ providedIn: "root" })
export class PtyTransport {
  spawn(
    options: PtySpawnOptionsContract,
    output: PtyOutputListenerContract,
  ): PtySpawnHandleContract {
    // The channel exists before the reader thread starts, so no output can be
    // lost between spawn and listener registration.
    const channel = new PtyDataChannel();
    channel.onmessage = (chunk) => output.onChunk(chunk);
    channel.onGap = (fromSeq, toSeq) => output.onChunksLost(fromSeq, toSeq);
    const ready = invoke("pty_spawn", {
      options: {
        name: options.terminalId,
        cols: options.cols,
        rows: options.rows,
        profile: options.profile,
        dev_mode: options.devMode,
      },
      survivesClient: options.survivesClient,
      onData: channel,
    }).catch((error: unknown) => {
      throw spawnFailure(error, options.terminalId);
    });
    return {
      ready,
      closeOutput: () => channel.close(),
    };
  }

  /**
   * Shows a shell that already runs. What its host kept of the output comes
   * first, then what the shell writes; whoever showed it before is told that
   * it was taken over.
   */
  attach(
    options: PtyAttachOptionsContract,
    output: PtyOutputListenerContract,
  ): PtySpawnHandleContract {
    const channel = new PtyDataChannel();
    channel.onmessage = (chunk) => output.onChunk(chunk);
    channel.onGap = (fromSeq, toSeq) => output.onChunksLost(fromSeq, toSeq);
    const ready = invoke<void>("pty_attach", {
      terminalId: options.terminalId,
      host: options.host ?? null,
      onData: channel,
    });
    return {
      ready,
      closeOutput: () => channel.close(),
    };
  }

  /**
   * Another Cogno attached to the shell: it runs on, shown there. `by` is
   * what that Cogno's machine is called, when it said.
   */
  onTakenOver(terminalId: string, listener: (by?: string) => void): Promise<() => void> {
    return listenInThisWindow<{ by?: string | null }>(`pty-taken-over:${terminalId}`, (payload) =>
      listener(payload?.by ?? undefined),
    );
  }

  /**
   * The Cogno that took the shell over let it go, or is gone: nobody shows
   * it now, and this window, which showed it before, may again.
   */
  onReleased(terminalId: string, listener: () => void): Promise<() => void> {
    return listenInThisWindow<void>(`pty-released:${terminalId}`, () => listener());
  }

  /** Says where the shell sits in this Cogno, for another Cogno to find it by. */
  label(terminalId: string, label: PtyLabelContract): Promise<void> {
    return invoke("pty_label", { terminalId, label });
  }

  ack(terminalId: string, seq: number): Promise<void> {
    return invoke("pty_ack", { terminalId, seq });
  }

  kill(terminalId: string): Promise<void> {
    return invoke("pty_kill", { terminalId });
  }

  /** Stops showing the shell; it runs on, for whoever shows it next. */
  detach(terminalId: string): Promise<void> {
    return invoke("pty_detach", { terminalId });
  }

  resize(terminalId: string, cols: number, rows: number): Promise<void> {
    return invoke("pty_resize", { terminalId, cols, rows });
  }

  onExit(terminalId: string, listener: (event: PtyExitEventContract) => void): Promise<() => void> {
    return listenInThisWindow<PtyExitEventContract>(`pty-exit:${terminalId}`, listener);
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

export type TerminalProcessContract = {
  terminalId: string;
  name: string;
  currentWorkingDirectory: string | null;
  /** Unix seconds. */
  startedAt: number;
};

/** Process inspection of PTY sessions (not part of the transport port). */
export const TauriPty = {
  getProcessTreeByTerminalId(terminalId: string) {
    return invoke<ProcessTreeSnapshot>("pty_get_process_tree_by_terminal_id", {
      terminalId,
    });
  },
  /** The processes under every terminal's shell, one pass over the machine. */
  listTerminalProcesses() {
    return invoke<TerminalProcessContract[]>("pty_list_terminal_processes");
  },
  /**
   * Ends a process under the terminal's shell and everything it started;
   * rejects for the shell itself and for a process outside that tree.
   */
  terminateProcess(terminalId: string, processId: number) {
    return invoke<void>("pty_terminate_process", { terminalId, processId });
  },
};
