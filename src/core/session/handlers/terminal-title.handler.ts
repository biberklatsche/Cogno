import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/** A program set the title (OSC 2). The session says so; the tab decides what to show. */
export class TerminalTitleHandler implements ITerminalHandler {
  private _disposables?: IDisposable[] = undefined;

  constructor(private readonly model: SessionModel) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables = [];
    this._disposables.push(
      terminal.parser.registerOscHandler(2, (title: string) => {
        this.model.report({ type: "titleChanged", oscCode: 2, title });
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
