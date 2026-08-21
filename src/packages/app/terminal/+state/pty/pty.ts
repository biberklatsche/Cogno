import { PtyChunkContract, PtySpawnHandleContract, PtyTransportPort } from "@cogno/core-api";
import { IDisposable } from "@cogno/core-support";
import { Environment } from "../../../common/environment/environment";
import { ErrorReporter } from "../../../common/error/error-reporter";
import { ShellProfile } from "../../../config/+models/shell-config";
import { TerminalDimensions } from "../handler/resize.handler";

export type PtyChunk = PtyChunkContract;
export type PtyChunkListener = (chunk: PtyChunk) => void;

export interface IPty extends IDisposable {
  /**
   * Spawns the shell. `onData` receives raw output chunks in order, from the
   * first byte on (the listener is wired before the shell starts).
   */
  spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
    onData: PtyChunkListener,
  ): Promise<void>;
  resize(dimensions: TerminalDimensions): void;
  /** Flow control: the terminal has parsed every chunk up to and including `seq`. */
  ack(seq: number): void;
  write(data: string): void;
  executeLineEditorAction(action: string, payload?: object): void;
  onExit(listener: (e: { exitCode: number; signal?: number }) => void): IDisposable;
  kill(signal?: string): void;
}

export class Pty implements IPty {
  private _terminalId: string | undefined = undefined;
  private _spawned = false;
  private _disposed = false;
  private _pendingResize?: TerminalDimensions;
  private _spawn: PtySpawnHandleContract | undefined = undefined;
  private _exitUnlisten: (() => void) | undefined = undefined;

  constructor(private readonly _transport: PtyTransportPort) {}

  async spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
    onData: PtyChunkListener,
  ): Promise<void> {
    this._spawn?.closeOutput();
    this._terminalId = terminalId;
    this._spawned = false;
    this._pendingResize = undefined;
    const spawn = this._transport.spawn(
      {
        terminalId,
        cols: dimensions.cols,
        rows: dimensions.rows,
        profile: shellProfile,
        devMode: Environment.isDevMode(),
      },
      {
        onChunk: onData,
        onChunksLost: (fromSeq, toSeq) => this.reportLostChunks(terminalId, fromSeq, toSeq),
      },
    );
    this._spawn = spawn;
    try {
      await spawn.ready;
    } catch (error) {
      // A rejected spawn must not leave the channel's transformCallback
      // registration behind: closeOutput() releases it (see
      // PtyDataChannel.close), same as the success-path cleanup below does.
      spawn.closeOutput();
      throw error;
    }
    if (this._disposed || this._spawn !== spawn) {
      // Disposed (or respawned) while the backend was still spawning. A
      // session nobody listens to must be killed now, or its reader parks
      // forever waiting for acks that never come. (A respawn under the same
      // id replaced it backend-side already.)
      spawn.closeOutput();
      if (this._disposed || this._terminalId !== terminalId) {
        this.killSession(terminalId);
      }
      return;
    }
    this._spawned = true;
    this.flushPendingResize();
  }

  ack(seq: number): void {
    if (!this._terminalId || this._disposed) return;
    this._transport.ack(this._terminalId, seq).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          operation: "ack",
          seq,
          terminalId: this._terminalId,
        },
      }),
    );
  }

  private reportLostChunks(terminalId: string, fromSeq: number, toSeq: number): void {
    ErrorReporter.reportException({
      error: new Error(
        `PTY output chunks ${fromSeq}..${toSeq - 1} were lost in transit and skipped`,
      ),
      handled: true,
      source: "Pty",
      context: {
        operation: "onData",
        fromSeq,
        toSeq,
        terminalId,
      },
    });
  }

  kill(signal?: string): void {
    if (!this._terminalId) return;
    this.killSession(this._terminalId, signal);
  }

  private killSession(terminalId: string, signal?: string): void {
    this._transport.kill(terminalId).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          operation: "kill",
          signal,
          terminalId,
        },
      }),
    );
  }

  resize(dimensions: TerminalDimensions) {
    if (!this._terminalId) throw Error("Please spawn Pty before resize.");
    if (!this.isValidDimensions(dimensions)) return;
    if (!this._spawned) {
      this._pendingResize = dimensions;
      return;
    }
    this._transport.resize(this._terminalId, dimensions.cols, dimensions.rows).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          columns: dimensions.cols,
          operation: "resize",
          rows: dimensions.rows,
          terminalId: this._terminalId,
        },
      }),
    );
  }

  write(data: string) {
    if (!this._terminalId) throw Error("Please spawn Pty before write to it.");
    this._transport.write(this._terminalId, data).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          operation: "write",
          terminalId: this._terminalId,
        },
      }),
    );
  }

  executeLineEditorAction(action: string, payload?: object) {
    if (!this._terminalId) throw Error("Please spawn Pty before executing line editor actions.");
    this._transport.executeLineEditorAction(this._terminalId, action, payload).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          action,
          operation: "executeLineEditorAction",
          terminalId: this._terminalId,
        },
      }),
    );
  }

  onExit(listener: (e: { exitCode: number; signal?: number }) => void): IDisposable {
    if (!this._terminalId) throw Error("Please spawn Pty before listen on exit.");
    const terminalId = this._terminalId;
    this._transport.onExit(terminalId, listener).then((unlisten) => {
      this._exitUnlisten = unlisten;
    });
    return {
      dispose: () => {
        this._exitUnlisten?.();
        this._exitUnlisten = undefined;
      },
    };
  }

  dispose(): void {
    this._disposed = true;
    // While a spawn is still in flight there is no session to kill yet; the
    // spawn continuation kills it as soon as it exists.
    if (this._spawned) this.kill();
    this._spawned = false;
    this._pendingResize = undefined;
    this._spawn?.closeOutput();
    this._spawn = undefined;
    this._exitUnlisten?.();
    this._exitUnlisten = undefined;
    this._terminalId = undefined;
  }

  private flushPendingResize() {
    if (!this._terminalId || !this._spawned || !this._pendingResize) return;
    const pendingResize = this._pendingResize;
    this._pendingResize = undefined;
    if (!this.isValidDimensions(pendingResize)) return;
    this._transport
      .resize(this._terminalId, pendingResize.cols, pendingResize.rows)
      .catch((error) =>
        ErrorReporter.reportException({
          error,
          handled: true,
          source: "Pty",
          context: {
            columns: pendingResize.cols,
            operation: "flushPendingResize",
            rows: pendingResize.rows,
            terminalId: this._terminalId,
          },
        }),
      );
  }

  private isValidDimensions(
    dimensions: Partial<TerminalDimensions> & { cols?: number | null; rows?: number | null },
  ): dimensions is TerminalDimensions {
    const { cols, rows } = dimensions;
    return (
      Number.isInteger(cols) &&
      Number.isInteger(rows) &&
      cols !== null &&
      cols !== undefined &&
      rows !== null &&
      rows !== undefined &&
      cols > 0 &&
      rows > 0
    );
  }
}
