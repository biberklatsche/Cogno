import { ITerminalHandler } from "./handler";
import { Terminal, IDisposable as XtermDisposable } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { FitAddon } from "@xterm/addon-fit";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalId } from "../../../grid-list/+model/model";

/**
 * Publishes inspector events with the current terminal dimensions (cols, rows) for this terminal instance.
 */
export class DimensionsInspectorHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _onResizeDispose?: XtermDisposable;

  constructor(private _bus: AppBus, private _terminalId: TerminalId) {}

  dispose(): void {
    this._onResizeDispose?.dispose();
    this._onResizeDispose = undefined;
  }

  register(terminal: Terminal, _fit?: FitAddon): IDisposable {
    this._terminal = terminal;

    // Publish immediately with current dimensions
    this.publish();

    // Listen for xterm resize events and always publish for this terminal
    this._onResizeDispose = terminal.onResize?.(() => {
      this.publish();
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
      payload: { type: "terminal-dimensions", data: { terminalId: this._terminalId, cols, rows } }
    });
  }
}
