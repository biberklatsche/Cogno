import { PtyDataChannel, TauriPty, TauriUnlistenFn } from "@cogno/app-tauri/pty";
import { IDisposable } from "@cogno/core-support";
import { ErrorReporter } from "../../../common/error/error-reporter";
import { ShellProfile } from "../../../config/+models/shell-config";
import { TerminalDimensions } from "../handler/resize.handler";

export type PtyDataListener = (data: Uint8Array) => void;

export interface IPty extends IDisposable {
  spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
  ): Promise<void>;
  resize(dimensions: TerminalDimensions): void;
  /**
   * Raw output chunks in arrival order. Chunks that arrive before a listener
   * is attached are buffered and replayed to the first listener.
   */
  onData(listener: PtyDataListener): IDisposable;
  /** Flow control: report `bytes` of output as parsed by the terminal. */
  ack(bytes: number): void;
  write(data: string): void;
  executeLineEditorAction(action: string, payload?: object): void;
  onExit(listener: (e: { exitCode: number; signal?: number }) => void): IDisposable;
  kill(signal?: string): void;
}

export class Pty implements IPty {
  private _terminalId: string | undefined = undefined;
  private _spawned = false;
  private _pendingResize?: TerminalDimensions;
  private _dataChannel: PtyDataChannel | undefined = undefined;
  private _dataListener: PtyDataListener | undefined = undefined;
  private _bufferedData: Uint8Array[] = [];
  private _exitUnlisten: TauriUnlistenFn | undefined = undefined;

  async spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
  ): Promise<void> {
    this._terminalId = terminalId;
    this._spawned = false;
    this._pendingResize = undefined;
    // The channel exists before the reader thread starts, so no output can be
    // lost between spawn and listener registration.
    const channel = TauriPty.createDataChannel();
    channel.onmessage = (chunk) => this.handleData(new Uint8Array(chunk));
    this._dataChannel = channel;
    await TauriPty.spawn(this._terminalId, shellProfile, dimensions, channel);
    this._spawned = true;
    this.flushPendingResize();
  }

  ack(bytes: number): void {
    if (!this._terminalId || bytes <= 0) return;
    TauriPty.ack(this._terminalId, bytes).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          operation: "ack",
          bytes,
          terminalId: this._terminalId,
        },
      }),
    );
  }

  private handleData(chunk: Uint8Array): void {
    if (this._dataListener) {
      this._dataListener(chunk);
    } else {
      this._bufferedData.push(chunk);
    }
  }

  kill(signal?: string): void {
    if (!this._terminalId) return;
    TauriPty.kill(this._terminalId).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          operation: "kill",
          signal,
          terminalId: this._terminalId,
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
    TauriPty.resize(this._terminalId, dimensions.cols, dimensions.rows).catch((error) =>
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

  onData(listener: PtyDataListener): IDisposable {
    if (!this._terminalId) throw Error("Please spawn Pty before listen on data.");
    this._dataListener = listener;
    const buffered = this._bufferedData;
    this._bufferedData = [];
    for (const chunk of buffered) {
      listener(chunk);
    }
    return {
      dispose: () => {
        if (this._dataListener === listener) {
          this._dataListener = undefined;
        }
      },
    };
  }

  write(data: string) {
    if (!this._terminalId) throw Error("Please spawn Pty before write to it.");
    TauriPty.write(this._terminalId, data).catch((error) =>
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
    TauriPty.executeLineEditorAction(this._terminalId, action, payload).catch((error) =>
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
    TauriPty.onExit(terminalId, listener).then((unlisten) => {
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
    this._spawned = false;
    this._pendingResize = undefined;
    this.kill();
    if (this._dataChannel) {
      this._dataChannel.onmessage = () => {};
      this._dataChannel = undefined;
    }
    this._dataListener = undefined;
    this._bufferedData = [];
    this._exitUnlisten?.();
    this._exitUnlisten = undefined;
    this._terminalId = undefined;
  }

  private flushPendingResize() {
    if (!this._terminalId || !this._spawned || !this._pendingResize) return;
    const pendingResize = this._pendingResize;
    this._pendingResize = undefined;
    if (!this.isValidDimensions(pendingResize)) return;
    TauriPty.resize(this._terminalId, pendingResize.cols, pendingResize.rows).catch((error) =>
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
