import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/** Programs set the title with OSC 2, or OSC 0 (icon name and title in one). */
const TITLE_OSC_CODES = [0, 2] as const;

/**
 * On Windows, ConPTY sends the console title via OSC 0, and its default is
 * the path of the shell executable (`C:\...\pwsh.exe`). That says nothing,
 * so it counts as no title.
 */
const EXECUTABLE_PATH_TITLE = /^[a-z]:\\[^<>:"|?*]*\.exe$/i;

/**
 * A program set or cleared the title (OSC 0 / OSC 2). The session says so;
 * the tab decides what to show. An empty title is how programs such as vim
 * or ssh hand the title back when they exit: it is stated as `undefined`,
 * as is ConPTY's executable-path default.
 *
 * Only a running command's title counts. At the prompt, titles come from the
 * shell or ConPTY (exe path, user@host) and say nothing; they are consumed
 * without a fact. When the command ends, the session clears its title.
 */
export class TerminalTitleHandler implements ITerminalHandler {
  private _disposables?: IDisposable[] = undefined;

  constructor(private readonly model: SessionModel) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._disposables = TITLE_OSC_CODES.map((code) =>
      terminal.parser.registerOscHandler(code, (title: string) => {
        if (this.model.isCommandRunning) {
          this.model.report({ type: "titleChanged", title: meaningfulTitle(title) });
        }
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

function meaningfulTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed || EXECUTABLE_PATH_TITLE.test(trimmed)) return undefined;
  return trimmed;
}
