import {
  HostErrorCode,
  isHostError,
  PtyChunkContract,
  PtyExitEventContract,
  PtyOpenHandleContract,
  PtyOutputListenerContract,
  PtyShellProfileContract,
  PtyTransport,
  SessionLifetimeContract,
} from "@cogno/platform";
import { IDisposable } from "@cogno/shared/support";
import { Observable, Subject } from "rxjs";
import {
  isValidTerminalDimensions,
  TerminalDimensions,
  TerminalMachineFault,
} from "./terminal-machine.events";

export type PtyChunkListener = (chunk: PtyChunkContract) => void;
export type PtyExitListener = (exit: PtyExitEventContract) => void;

/** Where the shell runs and how it is started. */
export type PtyOptions = {
  /**
   * The connected host on another machine the shell runs on; left out for
   * this one. A shell there is only ever attached to, never started.
   */
  readonly host?: string;
  /** Whether a shell started here goes on when Cogno is gone. */
  readonly lifetime: SessionLifetimeContract;
  /** The version of the shell integration a shell started here sources. */
  readonly integrationVersion: string;
};

export interface IPty extends IDisposable {
  /** Things the machine could not do; the host decides who is told. */
  readonly faults$: Observable<TerminalMachineFault>;
  /** Whether the shell is shown here: started or attached, not taken over and not ended. */
  readonly isLive: boolean;

  /**
   * Gives the shell up without ending it: another session of this terminal
   * takes it on. `dispose` ends the terminal for good, and the shell with it.
   */
  release(): void;

  /**
   * Spawns the shell. `onData` receives raw output chunks in order, from the
   * first byte on (the listener is wired before the shell starts).
   */
  spawn(
    terminalId: string,
    shellProfile: PtyShellProfileContract,
    dimensions: TerminalDimensions,
    onData: PtyChunkListener,
  ): Promise<void>;
  /**
   * Shows a shell that already runs under `terminalId` instead of starting
   * one. `onData` first receives what its host kept of the output.
   */
  attach(terminalId: string, onData: PtyChunkListener): Promise<void>;
  /**
   * Another Cogno took the shell over: it runs on, but not here any more.
   * A listener that subscribes afterwards is told at once.
   */
  onTakenOver(listener: (by?: string) => void): IDisposable;
  /**
   * The Cogno that took the shell over let it go: it can be shown here
   * again. A listener that subscribes afterwards is told at once.
   */
  onHandedBack(listener: () => void): IDisposable;
  resize(dimensions: TerminalDimensions): void;
  /** Flow control: the terminal has parsed every chunk up to and including `seq`. */
  ack(seq: number): void;
  write(data: string): void;
  executeLineEditorAction(action: string, payload?: object): void;
  /**
   * The shell ended. A listener that subscribes after the exit is told
   * immediately, so an exit racing the spawn is never lost.
   */
  onExit(listener: PtyExitListener): IDisposable;
}

/**
 * Where the PTY is. `opening` and `live` hold the open output; the others
 * hold none. Taken over and handed back are kept for whoever asks later.
 */
type PtyState =
  | { readonly kind: "idle" }
  | { readonly kind: "opening"; readonly terminalId: string; readonly output?: OpenOutput }
  | { readonly kind: "live"; readonly terminalId: string; readonly output: OpenOutput }
  | { readonly kind: "takenOver"; readonly terminalId: string; readonly by?: string }
  | { readonly kind: "handedBack"; readonly terminalId: string; readonly by?: string }
  /** `endsShell`: disposed for good, not released to another session. */
  | { readonly kind: "disposed"; readonly endsShell: boolean };

type OpenOutput = PtyOpenHandleContract<unknown>;

/**
 * Failures a request can meet without anything being wrong: the session
 * ended or passed to another Cogno while the request was on its way.
 */
const RACED_AN_END: readonly HostErrorCode[] = [
  "sessionNotFound",
  "attachedElsewhere",
  "connectionLost",
];

export class Pty implements IPty {
  private readonly faults$$ = new Subject<TerminalMachineFault>();
  private state: PtyState = { kind: "idle" };
  private _pendingResize?: TerminalDimensions;
  private _unlisten: (() => void) | undefined = undefined;
  private _exit: PtyExitEventContract | undefined = undefined;
  private readonly _exitListeners = new Set<PtyExitListener>();
  private readonly _takenOverListeners = new Set<(by?: string) => void>();
  private readonly _handedBackListeners = new Set<() => void>();

  constructor(
    private readonly _transport: PtyTransport,
    private readonly _options: PtyOptions,
  ) {}

  /**
   * Things that went wrong down here. The machine reports, it does not
   * handle: the session host subscribes and decides who is told.
   */
  get faults$(): Observable<TerminalMachineFault> {
    return this.faults$$.asObservable();
  }

  get isLive(): boolean {
    return this.state.kind === "live" && this._exit === undefined;
  }

  /** The terminal the PTY belongs to, while it has one. */
  private get terminalId(): string | undefined {
    return "terminalId" in this.state ? this.state.terminalId : undefined;
  }

  /** Reports a failure, unless it only raced the end of the session. */
  private reportUnlessRaced(fault: TerminalMachineFault): void {
    if (isHostError(fault.error, ...RACED_AN_END)) return;
    this.faults$$.next(fault);
  }

  spawn(
    terminalId: string,
    shellProfile: PtyShellProfileContract,
    dimensions: TerminalDimensions,
    onData: PtyChunkListener,
  ): Promise<void> {
    if (this._options.host !== undefined) {
      return Promise.reject(new Error("A shell on another machine is never started from here."));
    }
    return this.open(terminalId, onData, (output) =>
      this._transport.spawn(
        {
          terminalId,
          size: { cols: dimensions.cols, rows: dimensions.rows },
          profile: shellProfile,
          integrationVersion: this._options.integrationVersion,
          lifetime: this._options.lifetime,
        },
        output,
      ),
    );
  }

  attach(terminalId: string, onData: PtyChunkListener): Promise<void> {
    return this.open(terminalId, onData, (output) =>
      this._transport.attach({ terminalId, host: this._options.host }, output),
    );
  }

  /**
   * Starts or attaches (`start`), with everything around it that both need:
   * the listeners that must exist before the first byte, and the cleanup of
   * a session that is no longer wanted when it comes into being.
   */
  private async open(
    terminalId: string,
    onData: PtyChunkListener,
    start: (output: PtyOutputListenerContract) => OpenOutput,
  ): Promise<void> {
    if (this.state.kind === "disposed") throw new Error("The PTY is disposed.");
    this.closeOutput();
    this.state = { kind: "opening", terminalId };
    this._pendingResize = undefined;
    this._exit = undefined;
    this._unlisten?.();
    this._unlisten = undefined;
    // Listen before the shell exists: a shell that dies at once emits its
    // exit before the call even returns, and a takeover can cross an attach.
    const unlistens = await Promise.all([
      this._transport.onExit(terminalId, (exit) => this.notifyExit(exit)),
      this._transport.onTakenOver(terminalId, (by) => this.notifyTakenOver(terminalId, by)),
      this._transport.onHandedBack(terminalId, () => this.notifyHandedBack(terminalId)),
    ]);
    const unlisten = () => {
      for (const stop of unlistens) stop();
    };
    if (!this.isOpening(terminalId)) {
      unlisten();
      throw new Error("The PTY was closed while it opened.");
    }
    this._unlisten = unlisten;
    const output = start({
      onChunk: onData,
      onChunksLost: (fromSeq, toSeq) => this.reportLostChunks(terminalId, fromSeq, toSeq),
    });
    this.state = { kind: "opening", terminalId, output };
    try {
      await output.ready;
    } catch (error) {
      // A rejected open must not leave the channel's callback registration
      // behind: closing the output releases it (see PtyDataChannel.close).
      output.closeOutput();
      if (this.isOpening(terminalId, output)) this.state = { kind: "idle" };
      throw error;
    }
    if (!this.isOpening(terminalId, output)) {
      // Disposed, opened anew or taken over while the host was still at it.
      output.closeOutput();
      if (this.disposedForGood()) this.letGo(terminalId);
      return;
    }
    this.state = { kind: "live", terminalId, output };
    this.flushPendingResize();
  }

  /** The terminal whose output is open: the host knows it, answered or not. */
  private withOutput(): string | undefined {
    const state = this.state;
    if (state.kind === "live") return state.terminalId;
    if (state.kind === "opening" && state.output !== undefined) return state.terminalId;
    return undefined;
  }

  private isDisposed(): boolean {
    return this.state.kind === "disposed";
  }

  /** Disposed, not released: the shell goes with the terminal. */
  private disposedForGood(): boolean {
    return this.state.kind === "disposed" && this.state.endsShell;
  }

  private isOpening(terminalId: string, output?: OpenOutput): boolean {
    return (
      this.state.kind === "opening" &&
      this.state.terminalId === terminalId &&
      (output === undefined || this.state.output === output)
    );
  }

  /**
   * Acknowledges as soon as there is output to acknowledge: a host sends
   * what it kept of an attached shell before it answers, and a reader that
   * waits for acks must not wait for that answer.
   */
  ack(seq: number): void {
    const terminalId = this.withOutput();
    if (terminalId === undefined) return;
    this._transport
      .ack(terminalId, seq)
      .catch((error) =>
        this.reportUnlessRaced({ operation: "ack", error, context: { seq, terminalId } }),
      );
  }

  private reportLostChunks(terminalId: string, fromSeq: number, toSeq: number): void {
    this.faults$$.next({
      operation: "onData",
      error: new Error(
        `PTY output chunks ${fromSeq}..${toSeq - 1} were lost in transit and skipped`,
      ),
      context: { fromSeq, toSeq, terminalId },
    });
  }

  /**
   * This terminal is done with the session. A shell of this machine ends
   * with its terminal. One of another machine belongs to the Cogno there
   * and is only let go: it runs on, for that Cogno or this one to show again.
   */
  private letGo(terminalId: string): void {
    if (this._options.host === undefined) {
      this.killSession(terminalId);
      return;
    }
    this._transport
      .detach(terminalId)
      .catch((error) =>
        this.reportUnlessRaced({ operation: "detach", error, context: { terminalId } }),
      );
  }

  private killSession(terminalId: string): void {
    this._transport
      .kill(terminalId)
      .catch((error) =>
        this.reportUnlessRaced({ operation: "kill", error, context: { terminalId } }),
      );
  }

  resize(dimensions: TerminalDimensions) {
    if (!isValidTerminalDimensions(dimensions)) return;
    if (this.state.kind === "opening") {
      this._pendingResize = dimensions;
      return;
    }
    if (this.state.kind !== "live") return;
    this.sendResize(this.state.terminalId, dimensions, "resize");
  }

  private flushPendingResize(): void {
    const pending = this._pendingResize;
    this._pendingResize = undefined;
    if (pending && this.state.kind === "live") {
      this.sendResize(this.state.terminalId, pending, "flushPendingResize");
    }
  }

  private sendResize(terminalId: string, dimensions: TerminalDimensions, operation: string): void {
    this._transport
      .resize(terminalId, { cols: dimensions.cols, rows: dimensions.rows })
      .catch((error) =>
        this.reportUnlessRaced({
          operation,
          error,
          context: { columns: dimensions.cols, rows: dimensions.rows, terminalId },
        }),
      );
  }

  /** Typed into a shell this terminal does not show (any more) goes nowhere. */
  write(data: string) {
    if (this.state.kind !== "live") return;
    const terminalId = this.state.terminalId;
    this._transport
      .write(terminalId, data)
      .catch((error) =>
        this.reportUnlessRaced({ operation: "write", error, context: { terminalId } }),
      );
  }

  executeLineEditorAction(action: string, payload?: object) {
    if (this.state.kind !== "live") return;
    const terminalId = this.state.terminalId;
    this._transport.executeLineEditorAction(terminalId, action, payload).catch((error) =>
      this.reportUnlessRaced({
        operation: "executeLineEditorAction",
        error,
        context: { action, terminalId },
      }),
    );
  }

  onExit(listener: PtyExitListener): IDisposable {
    this._exitListeners.add(listener);
    if (this._exit) listener(this._exit);
    return { dispose: () => this._exitListeners.delete(listener) };
  }

  private notifyExit(exit: PtyExitEventContract): void {
    this._exit = exit;
    for (const listener of this._exitListeners) listener(exit);
  }

  onTakenOver(listener: (by?: string) => void): IDisposable {
    this._takenOverListeners.add(listener);
    if (this.state.kind === "takenOver" || this.state.kind === "handedBack") {
      listener(this.state.by);
    }
    return { dispose: () => this._takenOverListeners.delete(listener) };
  }

  onHandedBack(listener: () => void): IDisposable {
    this._handedBackListeners.add(listener);
    if (this.state.kind === "handedBack") listener();
    return { dispose: () => this._handedBackListeners.delete(listener) };
  }

  /**
   * The shell is another Cogno's now. Nothing of it is this machine's to
   * touch any more: disposing must not kill what runs on elsewhere.
   */
  private notifyTakenOver(terminalId: string, by?: string): void {
    if (this.terminalId !== terminalId || this.state.kind === "disposed") return;
    this.closeOutput();
    this._pendingResize = undefined;
    this.state = { kind: "takenOver", terminalId, by };
    for (const listener of this._takenOverListeners) listener(by);
  }

  private notifyHandedBack(terminalId: string): void {
    if (this.state.kind !== "takenOver" || this.state.terminalId !== terminalId) return;
    this.state = { kind: "handedBack", terminalId, by: this.state.by };
    for (const listener of this._handedBackListeners) listener();
  }

  private closeOutput(): void {
    if (this.state.kind === "opening" || this.state.kind === "live") {
      this.state.output?.closeOutput();
    }
  }

  dispose(): void {
    this.teardown(true);
  }

  release(): void {
    this.teardown(false);
  }

  private teardown(endsShell: boolean): void {
    if (this.isDisposed()) return;
    // While an open is still in flight there is no session to end yet; the
    // open's continuation ends it as soon as it exists. A shell taken over
    // by another Cogno is not this one's to end; one that was handed back is.
    const state = this.state;
    if (endsShell && (state.kind === "live" || state.kind === "handedBack")) {
      this.letGo(state.terminalId);
    }
    this.closeOutput();
    this.state = { kind: "disposed", endsShell };
    this._pendingResize = undefined;
    this._unlisten?.();
    this._unlisten = undefined;
    this._exitListeners.clear();
    this._takenOverListeners.clear();
    this._handedBackListeners.clear();
  }
}
