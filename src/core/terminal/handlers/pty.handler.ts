import { PtyChunkContract, PtyShellProfileContract } from "@cogno/platform";
import { TerminalId } from "@cogno/shared/domain";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { IPty } from "../pty";
import { ITerminalHandler } from "../terminal-handler";

/**
 * While the window is hidden, browsers throttle the timers xterm parses with
 * (down to once a minute), so parse-driven acks would stall the shell of any
 * minimized window. Hidden windows therefore acknowledge chunks on receipt
 * and let xterm buffer them, up to this many unparsed bytes; beyond that the
 * reader is held back like in the visible case (xterm itself discards writes
 * past 50 MiB, so this must stay well below).
 */
export const HIDDEN_UNPARSED_BUDGET_BYTES = 16 * 1024 * 1024;

/**
 * What the shell did, told to whoever is listening. The machine reports;
 * turning these into notifications, panes or activity indicators is session
 * and workbench work (ARCHITECTURE.md 2.1).
 */
export type PtyHandlerListener = {
  /** The shell process is up (or shown here); nothing has been parsed yet. */
  readonly onSpawned?: () => void;
  /** Another Cogno took the shell over; it runs on, but not here. */
  readonly onTakenOver?: (by?: string) => void;
  /** The Cogno that took the shell over let it go. */
  readonly onReleased?: () => void;
  /** The shell could not be started. */
  readonly onFailed?: (error: unknown) => void;
  /** The shell process ended. */
  readonly onExited?: (exitCode: number) => void;
  /** Output arrived - before it is parsed. */
  readonly onOutput?: () => void;
};

export class PtyHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _disposed = false;
  private _unparsedBytes = 0;
  private _lastParsedSeq = -1;
  private _lastAckedSeq = -1;
  private _ackScheduled = false;
  private readonly _disposables: IDisposable[] = [];

  constructor(
    private _terminalId: TerminalId,
    private _pty: IPty,
    private _shellProfile: PtyShellProfileContract,
    private _listener: PtyHandlerListener = {},
    private _isWindowHidden: () => boolean = () => document.visibilityState === "hidden",
    /** The shell already runs: show it instead of starting one. */
    private _attach = false,
  ) {}

  dispose(): void {
    this._disposed = true;
    this._disposables.forEach((disposable) => {
      disposable?.dispose();
    });
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    void this.start();
    return this;
  }

  /**
   * Tries again after a failure; the terminal stays registered. `how` says
   * whether a new shell is started or the running one is attached to again:
   * a shell of another machine is never started from here.
   */
  restart(how: "start" | "attach"): void {
    this._attach = how === "attach";
    void this.start();
  }

  private async start(): Promise<void> {
    const terminal = this._terminal;
    if (!terminal) return;
    try {
      await this.spawnPty(this._terminalId, terminal);
    } catch (error) {
      if (!this._disposed) this._listener.onFailed?.(error);
      return;
    }
    if (this._disposed) return;
    this._listener.onSpawned?.();
    this._disposables.push(terminal.onData((data) => this._pty?.write(data)));
    this._disposables.push(
      this._pty?.onExit((event) => {
        this._listener.onExited?.(event.exitCode);
      }),
    );
    this._disposables.push(this._pty.onTakenOver((by) => this._listener.onTakenOver?.(by)));
    this._disposables.push(this._pty.onReleased(() => this._listener.onReleased?.()));
  }

  private onPtyChunk(terminal: Terminal, chunk: PtyChunkContract): void {
    if (this._disposed) return;
    this._listener.onOutput?.();
    const bytes = chunk.data.byteLength;
    this._unparsedBytes += bytes;
    terminal.write(chunk.data, () => {
      this._unparsedBytes -= bytes;
      this.parsed(chunk.seq);
    });
    if (this._isWindowHidden() && this._unparsedBytes <= HIDDEN_UNPARSED_BUDGET_BYTES) {
      this.parsed(chunk.seq);
    }
  }

  /**
   * Chunks arrive and are parsed in sequence order, so the newest parsed
   * sequence number acknowledges everything before it. Acks are coalesced
   * per microtask: xterm runs the parse callbacks of one time slice
   * synchronously, so a slice costs one invoke however many chunks it parsed.
   */
  private parsed(seq: number): void {
    if (seq <= this._lastParsedSeq) return;
    this._lastParsedSeq = seq;
    if (this._ackScheduled) return;
    this._ackScheduled = true;
    queueMicrotask(() => {
      this._ackScheduled = false;
      if (this._disposed || this._lastParsedSeq <= this._lastAckedSeq) return;
      this._lastAckedSeq = this._lastParsedSeq;
      this._pty.ack(this._lastAckedSeq);
    });
  }

  private spawnPty(terminalId: TerminalId, terminal: Terminal) {
    if (this._attach) {
      return this._pty.attach(terminalId, (chunk) => this.onPtyChunk(terminal, chunk));
    }
    return this._pty.spawn(
      terminalId,
      this._shellProfile,
      {
        cols: terminal.cols,
        rows: terminal.rows,
      },
      (chunk) => this.onPtyChunk(terminal, chunk),
    );
  }
}
