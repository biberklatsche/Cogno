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
  private _watchedTextarea?: HTMLTextAreaElement;
  private readonly _onTextareaFocus = () => this.report(true);
  private readonly _onTextareaBlur = () => this.report(false);

  constructor(private readonly _onFocusChanged: FocusListener = () => undefined) {}

  dispose(): void {
    this.unwatchTextarea();
    this._terminal = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.watchTextarea();
    return this;
  }

  /**
   * Listens to the user moving the keyboard in and out of the terminal. xterm
   * creates its textarea only when it opens, which is after the handler is
   * registered - so whoever opens the terminal calls this again.
   */
  watchTextarea(): void {
    const textarea = this._terminal?.textarea;
    if (!textarea || textarea === this._watchedTextarea) return;
    this.unwatchTextarea();
    textarea.addEventListener("focus", this._onTextareaFocus);
    textarea.addEventListener("blur", this._onTextareaBlur);
    this._watchedTextarea = textarea;
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

  private unwatchTextarea(): void {
    this._watchedTextarea?.removeEventListener("focus", this._onTextareaFocus);
    this._watchedTextarea?.removeEventListener("blur", this._onTextareaBlur);
    this._watchedTextarea = undefined;
  }

  private report(focused: boolean): void {
    this._focused = focused;
    this._onFocusChanged(focused);
  }
}
