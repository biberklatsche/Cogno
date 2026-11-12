import { MachineState } from "@cogno/core/terminal/machine-state";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/**
 * ConEmu gave OSC 9 numbered sub-commands (`9;1;…` to `9;12`): sleep, tab
 * title, progress, working directory (`9;9;path`, which prompts written for
 * Windows Terminal send on every line) and more. They are not messages. A
 * number alone is one only where the command takes no argument; any other
 * number alone is a message (`9;3` says "3").
 */
const CONEMU_COMMAND = /^\s*(\d{1,2})(;|\s*$)/;
const CONEMU_PROGRESS = 4;
const CONEMU_LAST_COMMAND = 12;
/** Wait for Enter (`9;5`) and the prompt mark (`9;12`). */
const CONEMU_COMMANDS_WITHOUT_ARGUMENT = new Set([5, 12]);

const OSC777_NOTIFY_PREFIX = "notify;";

/**
 * A program asks for attention with a message - OSC 9 (`9;message`) or
 * OSC 777 (`777;notify;title;message`) - or reports progress
 * (`9;4;state;value`). Progress is a fact about the terminal and goes to the
 * machine state; the message is stated as a fact - whether it becomes a
 * notification, and through which channel, is decided elsewhere. Every other
 * ConEmu sub-command of OSC 9 is consumed without a fact.
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
        const conEmuCommand = conEmuCommandOf(data);
        if (conEmuCommand === CONEMU_PROGRESS) {
          this.tryHandleProgress(data);
          return true;
        }
        if (conEmuCommand !== undefined) return true;

        const message = singleLine(data);
        if (message) this.model.report({ type: "notificationRequested", message });
        return true;
      }),
      terminal.parser.registerOscHandler(777, (data: string) => {
        // Only `notify` is a message; other 777 commands mean nothing here.
        if (!data?.startsWith(OSC777_NOTIFY_PREFIX)) return true;
        const payload = data.slice(OSC777_NOTIFY_PREFIX.length);
        const separator = payload.indexOf(";");
        const title = singleLine(separator === -1 ? payload : payload.slice(0, separator));
        const message = singleLine(separator === -1 ? "" : payload.slice(separator + 1));
        if (message) {
          this.model.report({
            type: "notificationRequested",
            message,
            ...(title ? { title } : {}),
          });
        } else if (title) {
          this.model.report({ type: "notificationRequested", message: title });
        }
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

function conEmuCommandOf(data: string | undefined): number | undefined {
  const match = CONEMU_COMMAND.exec(data ?? "");
  if (!match) return undefined;
  const command = Number.parseInt(match[1], 10);
  if (command < 1 || command > CONEMU_LAST_COMMAND) return undefined;
  const hasArgument = match[2] === ";";
  return hasArgument || CONEMU_COMMANDS_WITHOUT_ARGUMENT.has(command) ? command : undefined;
}

function singleLine(text: string | undefined): string {
  return (text ?? "").replace(/\r/g, "").replace(/\n+/g, " ").trim();
}
