import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { ITerminalHandler } from "../terminal-handler";

/** Told whenever the terminal gains or loses the keyboard. */
export type FocusListener = (focused: boolean) => void;

/**
 * Focus on the machine: hand the keyboard to xterm or take it away, and say
 * when that happened - including when the user clicked into it.
 *
 * Who asked for the focus, and what else should follow from it (clearing an
 * unread badge, telling the workbench which pane is active) is session and
 * workbench work (ARCHITECTURE.md 2.1).
 */
export class FocusHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _focused = false;

  constructor(private readonly _onFocusChanged: FocusListener = () => undefined) {}

  dispose(): void {
    this._terminal = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    const textarea = terminal.textarea;
    textarea?.addEventListener("focus", () => this.report(true));
    textarea?.addEventListener("blur", () => this.report(false));
    return this;
  }

  focus(): void {
    this._terminal?.focus();
    this.report(true);
  }

  blur(): void {
    this._terminal?.blur();
    this.report(false);
  }

  hasFocus(): boolean {
    return this._focused;
  }

  private report(focused: boolean): void {
    this._focused = focused;
    this._onFocusChanged(focused);
  }
}
