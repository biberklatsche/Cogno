import { Injectable } from "@angular/core";
import { SERIALIZE_TO_IPC_FN, transformCallback } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invokeHost } from "./host-error";
import {
  PtyShellProfileContract,
  SessionInfoContract,
  SessionLifetimeContract,
  SessionPlacementContract,
  TerminalSizeContract,
} from "./session-contracts";

export type PtySpawnOptionsContract = {
  terminalId: string;
  size: TerminalSizeContract;
  profile: PtyShellProfileContract;
  /** The version of the shell integration the shell sources. */
  integrationVersion: string;
  lifetime: SessionLifetimeContract;
};

/** What a start did. */
export type PtySpawnedContract = { shellProcessId: number | null };

/** The events of one terminal, as `<name>:<terminal id>` (`hosts/webview.rs`). */
const PTY_EXIT_EVENT = "pty-exit";
const PTY_TAKEN_OVER_EVENT = "pty-taken-over";
const PTY_HANDED_BACK_EVENT = "pty-handed-back";

function terminalEvent(name: string, terminalId: string): string {
  return `${name}:${terminalId}`;
}

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
 * Opens the channel a shell's output comes through, then the shell (`open`
 * starts or attaches it). The channel exists before the host sends, so no
 * output is lost between the call and the listener.
 */
function openOutput<T>(
  output: PtyOutputListenerContract,
  open: (onData: PtyDataChannel) => Promise<T>,
): PtyOpenHandleContract<T> {
  const channel = new PtyDataChannel();
  channel.onmessage = (chunk) => output.onChunk(chunk);
  channel.onGap = (fromSeq, toSeq) => output.onChunksLost(fromSeq, toSeq);
  return { ready: open(channel), closeOutput: () => channel.close() };
}

/** A shell that already runs, and where. */
export type PtyAttachOptionsContract = {
  terminalId: string;
  host?: string;
};

/** One chunk of raw PTY output. `seq` numbers the chunks of a spawn from 0 up. */
export type PtyChunkContract = { seq: number; data: Uint8Array };

/** Why a terminal ended. */
export type TerminalExitContract =
  | { kind: "exited"; code: number }
  /** Another Cogno ended it. */
  | { kind: "killedByAnotherClient" }
  /** Reading or writing the PTY failed. */
  | { kind: "ptyFailed" }
  /** The connection to its host broke; the shell may run on there. */
  | { kind: "connectionLost" };

export type PtyExitEventContract = { reason: TerminalExitContract };

export interface PtyOutputListenerContract {
  /** Chunks arrive strictly in sequence order. */
  onChunk(chunk: PtyChunkContract): void;
  /** Chunks `fromSeq` up to (excluding) `toSeq` were lost in transit and skipped. */
  onChunksLost(fromSeq: number, toSeq: number): void;
}

export interface PtyOpenHandleContract<T> {
  /**
   * Resolves once the shell runs (or, for an attach, once it is shown here),
   * rejects with a `HostError` when it could not be spawned or is not there
   * to attach to.
   */
  readonly ready: Promise<T>;
  /**
   * Stops output delivery for good. Safe to call before `ready` settles;
   * the backend session (if it comes into existence) still has to be killed.
   */
  closeOutput(): void;
}

/** The state a process is in (`ProcessStatus` in `cogno-host`). */
export type ProcessStatusContract =
  | "Running"
  | "Sleeping"
  | "Idle"
  | "Stopped"
  | "Zombie"
  | "Dead"
  | "Other";

/** What the process-info panel shows about one process. */
export type ProcessDetails = {
  processId: number;
  parentProcessId: number | null;
  name: string;
  currentWorkingDirectory: string | null;
  status: ProcessStatusContract;
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
 * Transport to the hosts' shells over Tauri commands: `pty_spawn` and
 * `pty_attach` with a `PtyDataChannel` for output, `pty_ack` for flow
 * control, plus the usual write/resize/kill. Output is pushed through the
 * listener handed to `spawn` or `attach` (wired before the shell starts, so
 * no byte is lost) and subject to flow control: the host stops reading once
 * too much output is unacknowledged, so the consumer must `ack` chunks as it
 * processes them. Every failure is a `HostError`.
 */
@Injectable({ providedIn: "root" })
export class PtyTransport {
  /** Rejects with `shellAlreadyRuns` when a shell runs under the id already. */
  spawn(
    options: PtySpawnOptionsContract,
    output: PtyOutputListenerContract,
  ): PtyOpenHandleContract<PtySpawnedContract> {
    return openOutput(output, (onData) =>
      invokeHost<PtySpawnedContract>("pty_spawn", {
        options: {
          terminal_id: options.terminalId,
          size: options.size,
          profile: options.profile,
          integration_version: options.integrationVersion,
        },
        lifetime: options.lifetime,
        onData,
      }),
    );
  }

  /**
   * Shows a shell that already runs. What its host kept of the output comes
   * first, then what the shell writes; whoever showed it before is told that
   * it was taken over. Rejects with `sessionNotFound` when it does not run.
   */
  attach(
    options: PtyAttachOptionsContract,
    output: PtyOutputListenerContract,
  ): PtyOpenHandleContract<SessionInfoContract> {
    return openOutput(output, (onData) =>
      invokeHost<SessionInfoContract>("pty_attach", {
        terminalId: options.terminalId,
        host: options.host ?? null,
        onData,
      }),
    );
  }

  /**
   * Another Cogno attached to the shell: it runs on, shown there. `by` is
   * what that Cogno's machine is called, when it said.
   */
  onTakenOver(terminalId: string, listener: (by?: string) => void): Promise<() => void> {
    return listenInThisWindow<{ by: string | null }>(
      terminalEvent(PTY_TAKEN_OVER_EVENT, terminalId),
      (payload) => listener(payload?.by ?? undefined),
    );
  }

  /**
   * The Cogno that took the shell over let it go, or is gone: nobody shows
   * it now, and this window, which showed it before, may again.
   */
  onHandedBack(terminalId: string, listener: () => void): Promise<() => void> {
    return listenInThisWindow<void>(terminalEvent(PTY_HANDED_BACK_EVENT, terminalId), () =>
      listener(),
    );
  }

  /** Says where the shell sits in this Cogno, for another Cogno to find it by. */
  place(terminalId: string, placement: SessionPlacementContract): Promise<void> {
    return invokeHost("pty_place", { terminalId, placement });
  }

  ack(terminalId: string, seq: number): Promise<void> {
    return invokeHost("pty_ack", { terminalId, seq });
  }

  kill(terminalId: string): Promise<void> {
    return invokeHost("pty_kill", { terminalId });
  }

  /** Stops showing the shell; it runs on, for whoever shows it next. */
  detach(terminalId: string): Promise<void> {
    return invokeHost("pty_detach", { terminalId });
  }

  resize(terminalId: string, size: TerminalSizeContract): Promise<void> {
    return invokeHost("pty_resize", { terminalId, size });
  }

  onExit(terminalId: string, listener: (event: PtyExitEventContract) => void): Promise<() => void> {
    return listenInThisWindow<PtyExitEventContract>(
      terminalEvent(PTY_EXIT_EVENT, terminalId),
      listener,
    );
  }

  write(terminalId: string, data: string): Promise<void> {
    return invokeHost("pty_write", { terminalId, data });
  }

  /** Rejects with `lineEditorUnavailable` for a shell that takes no actions. */
  executeLineEditorAction(terminalId: string, action: string, payload?: object): Promise<void> {
    return invokeHost("pty_execute_line_editor_action", {
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
    return invokeHost<ProcessTreeSnapshot>("pty_get_process_tree_by_terminal_id", {
      terminalId,
    });
  },
  /** The processes under every terminal's shell, one pass over the machine. */
  listTerminalProcesses() {
    return invokeHost<TerminalProcessContract[]>("pty_list_terminal_processes");
  },
  /**
   * Ends a process under the terminal's shell and everything it started;
   * rejects with `notInTerminalTree` for the shell itself and for a process
   * outside that tree.
   */
  terminateProcess(terminalId: string, processId: number) {
    return invokeHost<void>("pty_terminate_process", { terminalId, processId });
  },
  /**
   * Ends what runs in the foreground of the terminal; the shell and its
   * background jobs stay. On Windows everything under the shell ends.
   */
  terminateForegroundJob(terminalId: string) {
    return invokeHost<void>("pty_terminate_foreground_job", { terminalId });
  },
};
