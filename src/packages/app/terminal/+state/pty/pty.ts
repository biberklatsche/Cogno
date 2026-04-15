import { TauriPty, TauriUnlistenFn } from "@cogno/app-tauri/pty";
import { ErrorReporter } from "../../../common/error/error-reporter";
import { IDisposable } from "../../../common/models/models";
import { ShellProfile } from "../../../config/+models/shell-config";
import { TerminalDimensions } from "../handler/resize.handler";

export interface IPty extends IDisposable {
  spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
  ): Promise<void>;
  resize(dimensions: TerminalDimensions): void;
  onData(listener: (e: string) => any): IDisposable;
  write(data: string): void;
  executeShellAction(action: string, payload?: object): void;
  onExit(listener: (e: { exitCode: number; signal?: number }) => any): IDisposable;
  kill(signal?: string): void;
}

export class Pty implements IPty {
  private _terminalId: string | undefined = undefined;
  private _spawned = false;
  private _pendingResize?: TerminalDimensions;
  private _dataUnlisten: TauriUnlistenFn | undefined = undefined;
  private _exitUnlisten: TauriUnlistenFn | undefined = undefined;

  async spawn(
    terminalId: string,
    shellProfile: ShellProfile,
    dimensions: TerminalDimensions,
  ): Promise<void> {
    this._terminalId = terminalId;
    this._spawned = false;
    this._pendingResize = undefined;
    await TauriPty.spawn(this._terminalId, shellProfile, dimensions);
    this._spawned = true;
    this.flushPendingResize();
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

  onData(listener: (e: string) => any): IDisposable {
    if (!this._terminalId) throw Error("Please spawn Pty before listen on data.");
    const terminalId = this._terminalId;
    TauriPty.onData(terminalId, listener).then((unlisten) => {
      this._dataUnlisten = unlisten;
    });
    return {
      dispose: () => {
        this._dataUnlisten?.();
        this._dataUnlisten = undefined;
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

  executeShellAction(action: string, payload?: object) {
    if (!this._terminalId) throw Error("Please spawn Pty before executing shell actions.");
    TauriPty.executeShellAction(this._terminalId, action, payload).catch((error) =>
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "Pty",
        context: {
          action,
          operation: "executeShellAction",
          terminalId: this._terminalId,
        },
      }),
    );
  }

  onExit(listener: (e: { exitCode: number; signal?: number }) => any): IDisposable {
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
    this._dataUnlisten?.();
    this._exitUnlisten?.();
    this._dataUnlisten = undefined;
    this._exitUnlisten = undefined;
    this._terminalId = undefined;
  }

  private flushPendingResize() {
    if (!this._terminalId || !this._spawned || !this._pendingResize) return;
    const pendingResize = this._pendingResize;
    this._pendingResize = undefined;
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
}
