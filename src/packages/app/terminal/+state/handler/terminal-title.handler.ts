import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { TerminalId } from "@cogno/shared/ports";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { AppBus } from "../../../app-bus/app-bus";

export class TerminalTitleHandler implements ITerminalHandler {
  private _disposables?: IDisposable[] = undefined;

  constructor(
    private _terminalId: TerminalId,
    private _bus: AppBus,
  ) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables = [];
    this._disposables.push(
      terminal.parser.registerOscHandler(2, (title: string) => {
        this._bus.publish({
          type: "TerminalTitleChanged",
          payload: { oscCode: 2, terminalId: this._terminalId, title },
        });
        return true;
      }),
    );
    return this;
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
