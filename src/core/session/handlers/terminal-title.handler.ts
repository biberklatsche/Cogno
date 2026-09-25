import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/** Programs set the title with OSC 2, or OSC 0 (icon name and title in one). */
const TITLE_OSC_CODES = [0, 2] as const;

/**
 * A program set or cleared the title (OSC 0 / OSC 2). The session says so;
 * the tab decides what to show. An empty title is how programs such as vim
 * or ssh hand the title back when they exit: it is stated as `undefined`.
 */
export class TerminalTitleHandler implements ITerminalHandler {
  private _disposables?: IDisposable[] = undefined;

  constructor(private readonly model: SessionModel) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables = TITLE_OSC_CODES.map((code) =>
      terminal.parser.registerOscHandler(code, (title: string) => {
        this.model.report({ type: "titleChanged", title: title.trim() || undefined });
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
