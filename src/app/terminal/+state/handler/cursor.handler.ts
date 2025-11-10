import { ITerminalHandler } from "./handler";
import { Terminal } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { FitAddon } from "@xterm/addon-fit";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalId } from "../../../grid-list/+model/model";

/**
 * Publishes inspector events with the current terminal cursor position (col,row)
 * whenever the cursor moves inside xterm.
 */
export class CursorHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _cursorListener?: IDisposable;

  constructor(private _bus: AppBus, private _terminalId: TerminalId) {}

  dispose(): void {
    this._cursorListener?.dispose?.();
    this._cursorListener = undefined;
    this._terminal = undefined;
  }

  register(terminal: Terminal, _fit?: FitAddon): IDisposable {
    this._terminal = terminal;

    // Listen for cursor moves from xterm
    this._cursorListener = terminal.onCursorMove(() => {
      if (!this._terminal) return;

      // Default values
      let col = 1;
      let viewportRow = 1;
      let row = 1;
      let char = "";

      try {
        const buffer: any = (this._terminal as any).buffer?.active ?? (this._terminal as any).buffer?.normal ?? (this._terminal as any).buffer;
        if (buffer) {
          const cursorX: number = buffer.cursorX ?? 0; // 0-based column in viewport
          const cursorYViewport: number = buffer.cursorY ?? 0; // 0-based row in viewport
          const viewportY: number = buffer.viewportY ?? 0; // top of viewport absolute 0-based
          const cursorYAbsolute: number = cursorYViewport + viewportY; // absolute row in buffer

          col = (cursorX ?? 0) + 1; // 1-based for inspector
          viewportRow = cursorYViewport + 1; // 1-based within viewport
          row = cursorYAbsolute + 1; // 1-based within viewport

          // Get character under cursor if present (use absolute row)
          const line = buffer.getLine?.(cursorYAbsolute);
          const cell = line?.getCell?.(cursorX);
          const ch = cell?.getChars?.();
          if (typeof ch === "string" && ch.length > 0) {
            char = ch;
          }
        }
      } catch {
        // ignore errors and keep defaults
      }

      this._bus.publish({
        path: ["inspector"],
        type: "Inspector",
        payload: { type: "terminal-cursor-position", data: { terminalId: this._terminalId, viewportCol: col, viewportRow: viewportRow, char: char, col: col, row: row } }
      });
    });

    return this;
  }
}
