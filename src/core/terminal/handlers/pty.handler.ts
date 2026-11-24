import { PtyChunkContract, PtyShellProfileContract, TerminalExitContract } from "@cogno/platform";
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

/** Whether the shell is started here or an already running one is shown. */
export type PtyOpenMode = "spawn" | "attach";

/**
 * What the shell did, told to whoever is listening. The machine reports;
 * turning these into notifications, panes or activity indicators is session
 * and workbench work (ARCHITECTURE.md 2.1).
 */
export type PtyHandlerListener = {
  /**
   * The shell is up: started (`spawn`) or shown here (`attach`); nothing has
   * been parsed yet.
   */
  readonly onSpawned?: (mode: PtyOpenMode) => void;
  /** Another Cogno took the shell over; it runs on, but not here. */
  readonly onTakenOver?: (by?: string) => void;
  /** The Cogno that took the shell over let it go. */
  readonly onHandedBack?: () => void;
  /** The shell could not be started (`spawn`) or shown (`attach`). */
  readonly onFailed?: (error: unknown, mode: PtyOpenMode) => void;
  /** The shell ended. */
  readonly onExited?: (reason: TerminalExitContract) => void;
  /** Output arrived - before it is parsed. */
  readonly onOutput?: () => void;
};

export type PtyHandlerOptions = {
  readonly mode: PtyOpenMode;
  readonly listener?: PtyHandlerListener;
  readonly isWindowHidden?: () => boolean;
};

export class PtyHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _disposed = false;
  private _unparsedBytes = 0;
  private _lastParsedSeq = -1;
  private _lastAckedSeq = -1;
  private _ackScheduled = false;
  /** Counts the starts; a start that was replaced reports nothing. */
  private _starts = 0;
  private readonly _disposables: IDisposable[] = [];
  private readonly _listener: PtyHandlerListener;
  private readonly _isWindowHidden: () => boolean;

  constructor(
    private readonly _terminalId: TerminalId,
    private readonly _pty: IPty,
    private readonly _shellProfile: PtyShellProfileContract,
    private readonly _options: PtyHandlerOptions,
  ) {
    this._listener = _options.listener ?? {};
    this._isWindowHidden = _options.isWindowHidden ?? (() => document.visibilityState === "hidden");
  }

  dispose(): void {
    this._disposed = true;
    for (const disposable of this._disposables) disposable.dispose();
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    // Once, before the first start: what the shell does from its first
    // moment on - a takeover that crosses the attach included - is heard.
    this._disposables.push(
      terminal.onData((data) => this._pty.write(data)),
      this._pty.onExit((event) => this._listener.onExited?.(event.reason)),
      this._pty.onTakenOver((by) => this._listener.onTakenOver?.(by)),
      this._pty.onHandedBack(() => this._listener.onHandedBack?.()),
    );
    void this.start(this._options.mode);
    return this;
  }

  /**
   * Tries again after a failure; the terminal stays registered. A shell of
   * another machine is attached to again, never started from here.
   */
  restart(mode: PtyOpenMode): void {
    void this.start(mode);
  }

  private async start(mode: PtyOpenMode): Promise<void> {
    const terminal = this._terminal;
    if (!terminal) return;
    const start = ++this._starts;
    // A new output stream counts its chunks from 0 again.
    this._lastParsedSeq = -1;
    this._lastAckedSeq = -1;
    this._unparsedBytes = 0;
    const onData = (chunk: PtyChunkContract) => this.onPtyChunk(terminal, chunk);
    try {
      if (mode === "attach") {
        await this._pty.attach(this._terminalId, onData);
      } else {
        await this._pty.spawn(
          this._terminalId,
          this._shellProfile,
          { cols: terminal.cols, rows: terminal.rows },
          onData,
        );
      }
    } catch (error) {
      if (this.isCurrent(start)) this._listener.onFailed?.(error, mode);
      return;
    }
    // Taken over or ended while it opened: the listener heard that instead.
    if (this.isCurrent(start) && this._pty.isLive) this._listener.onSpawned?.(mode);
  }

  private isCurrent(start: number): boolean {
    return !this._disposed && start === this._starts;
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
}
