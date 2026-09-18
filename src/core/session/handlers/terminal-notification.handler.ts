import { MachineState } from "@cogno/core/terminal/machine-state";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/**
 * OSC 9: a program reports progress (`9;4;state;value`) or asks for
 * attention with a message. Progress is a fact about the terminal and goes
 * to the machine state; the message is stated as a fact - whether it
 * becomes a notification, and through which channel, is decided elsewhere.
 */
export class TerminalNotificationHandler implements ITerminalHandler {
  private _disposables?: IDisposable[] = undefined;

  constructor(
    private readonly model: SessionModel,
    private readonly machine: MachineState,
  ) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables = [];
    this._disposables.push(
      terminal.parser.registerOscHandler(9, (data: string) => {
        if (this.tryHandleProgress(data)) {
          return true;
        }

        const message = (data ?? "").replace(/\r/g, "").replace(/\n+/g, " ").trim();
        if (!message) return true;

        this.model.report({ type: "notificationRequested", message });
        return true;
      }),
    );
    return this;
  }

  private tryHandleProgress(data: string | undefined): boolean {
    const match = /^\s*4;([^;]*)(?:;(.*))?\s*$/.exec(data ?? "");
    if (!match) {
      return false;
    }

    const state = Number.parseInt(match[1] ?? "", 10);
    const progress = Number.parseInt(match[2] ?? "0", 10);

    switch (state) {
      case 0:
        this.machine.setProgress("hidden", 0);
        return true;
      case 1:
        this.machine.setProgress("default", progress);
        return true;
      case 2:
        this.machine.setProgress("error", progress);
        return true;
      case 3:
        this.machine.setProgress("indeterminate", 0);
        return true;
      case 4:
        this.machine.setProgress("warning", progress);
        return true;
      default:
        return false;
    }
  }

  dispose(): void {
    if (this._disposables) {
      this._disposables.forEach((d) => {
        d.dispose();
      });
      this._disposables = undefined;
    }
  }
}
