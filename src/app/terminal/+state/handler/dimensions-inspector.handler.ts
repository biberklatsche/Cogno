import { ITerminalHandler } from "./handler";
import { Terminal, IDisposable as XtermDisposable } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { FitAddon } from "@xterm/addon-fit";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalId } from "../../../grid-list/+model/model";
import { Subscription } from "rxjs";

/**
 * Publishes inspector events with the current terminal dimensions (cols, rows).
 * Only the terminal that currently has focus will publish updates.
 */
export class DimensionsInspectorHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _focused = false;
  private _onResizeDispose?: XtermDisposable;
  private _subscription = new Subscription();

  constructor(private _bus: AppBus, private _terminalId: TerminalId) {}

  dispose(): void {
    this._onResizeDispose?.dispose();
    this._onResizeDispose = undefined;
    this._subscription.unsubscribe();
  }

  register(terminal: Terminal, _fit?: FitAddon): IDisposable {
    this._terminal = terminal;

    // Track terminal focus/blur via AppBus (emitted by FocusHandler)
      this._subscription.add(this._bus.on$({ path: ["app"], type: ["TerminalFocused", "TerminalBlurred"] as any })
      .subscribe((e: any) => {
        if (e.type === "TerminalFocused") {
          this._focused = true;
          // publish immediately on focus with current dimensions
          this.publish();
        } else {
          this._focused = false;
        }
      }));

    // Listen for xterm resize events
    this._onResizeDispose = terminal.onResize?.(() => {
      if (this._focused) this.publish();
    }) as any;

    return this;
  }

  private publish() {
    const cols = this._terminal?.cols ?? 0;
    const rows = this._terminal?.rows ?? 0;
    if (cols <= 0 || rows <= 0) return;
    this._bus.publish({
      path: ["inspector"],
      type: "Inspector",
      payload: { type: "terminal-dimensions", data: { cols, rows } }
    });
  }
}
