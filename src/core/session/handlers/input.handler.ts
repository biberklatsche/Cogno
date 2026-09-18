import { IPty } from "@cogno/core/terminal/pty";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { Char, IDisposable } from "@cogno/shared/support";
import { IDisposable as IXtermDisposable, Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";

/**
 * The receiving side of "write this into the terminal" and "clear it": the
 * later injectInput operation of the API. Who asks is not its business.
 */
export class InputHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private terminalInputDisposable?: IXtermDisposable;

  constructor(
    private readonly model: SessionModel,
    private readonly pty: IPty,
    /** Fired on user-initiated raw writes so the session can scroll back to the prompt. */
    private readonly onUserInput?: () => void,
  ) {}

  dispose(): void {
    this.terminalInputDisposable?.dispose();
    this.terminalInputDisposable = undefined;
    this._terminal = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.terminalInputDisposable = terminal.onData(() => {
      this.model.clearUnreadNotification();
    });
    return this;
  }

  clearBuffer(): void {
    this._terminal?.clear();
  }

  /** Writes text as if typed; with `autoExecute` an Enter follows once the text is out. */
  writeRaw(text: string, autoExecute?: boolean): void {
    this.pty.write(text);
    this.onUserInput?.();
    if (autoExecute) {
      queueMicrotask(() => this.pty.write(Char.Enter));
    }
  }
}
