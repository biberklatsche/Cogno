import { TerminalId } from "@cogno/core-api";
import { IDisposable } from "@cogno/core-support";
import { Terminal } from "@xterm/xterm";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalActivityService } from "../../../common/terminal-activity/terminal-activity.service";
import { ShellProfile } from "../../../config/+models/shell-config";
import { IPty } from "../pty/pty";
import { ITerminalHandler } from "./handler";

/**
 * Parsed-but-unacknowledged bytes are reported to the PTY reader in batches
 * of this size. Well below the reader's high watermark, so interactive
 * sessions never block; under load the acks keep the reader flowing.
 */
export const PTY_ACK_THRESHOLD_BYTES = 64 * 1024;

export class PtyHandler implements ITerminalHandler {
  private _resizeObserver: ResizeObserver | undefined = undefined;
  private _resizeRaf?: number;
  private _firstWriteEvent: boolean = false;
  private _disposed = false;
  private _unacknowledgedBytes = 0;
  private readonly _disposables: IDisposable[] = [];

  constructor(
    private _terminalId: TerminalId,
    private _pty: IPty,
    private _shellProfile: ShellProfile,
    private _bus: AppBus,
    private _terminalActivity?: TerminalActivityService,
  ) {}

  dispose(): void {
    this._disposed = true;
    this._disposables.forEach((disposable) => {
      disposable?.dispose();
    });
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this.spawnPty(this._terminalId, terminal).then((_) => {
      this._disposables.push(terminal.onData((data) => this._pty?.write(data)));
      this._disposables.push(
        this._pty?.onData((data) => {
          this._terminalActivity?.emit(this._terminalId);
          if (!this._firstWriteEvent) {
            this._firstWriteEvent = true;
            this.publishPtyInitializedAfterFirstParse(terminal);
          }
          terminal.write(data, () => this.acknowledge(data.byteLength));
        }),
      );
      this._disposables.push(
        this._pty?.onExit((_) => {
          this._bus.publish({
            path: ["app", "terminal"],
            type: "RemovePane",
            payload: this._terminalId,
          });
        }),
      );
    });
    return this;
  }

  private publishPtyInitializedAfterFirstParse(terminal: Terminal): void {
    const shellType = this._shellProfile.shell_type;
    if (!shellType) {
      throw new Error("Shell profile must define a shell type.");
    }
    const disposable = terminal.onWriteParsed(() => {
      this._bus.publish({
        path: ["app", "terminal", this._terminalId],
        type: "PtyInitialized",
        payload: {
          terminalId: this._terminalId,
          shellType,
        },
      });
      disposable.dispose();
    });
  }

  private acknowledge(bytes: number): void {
    if (this._disposed) return;
    this._unacknowledgedBytes += bytes;
    if (this._unacknowledgedBytes < PTY_ACK_THRESHOLD_BYTES) return;
    const toAck = this._unacknowledgedBytes;
    this._unacknowledgedBytes = 0;
    this._pty.ack(toAck);
  }

  private spawnPty(terminalId: TerminalId, terminal: Terminal) {
    return this._pty.spawn(terminalId, this._shellProfile, {
      cols: terminal.cols,
      rows: terminal.rows,
    });
  }
}
