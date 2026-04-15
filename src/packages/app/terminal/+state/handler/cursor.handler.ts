import { Terminal } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";

export class CursorHandler implements ITerminalHandler {
  private _cursorListener?: IDisposable;

  constructor(private stateManager: TerminalStateManager) {}

  dispose(): void {
    this._cursorListener?.dispose?.();
    this._cursorListener = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    // Listen for cursor moves from xterm
    this._cursorListener = terminal.onCursorMove(() => {
      if (!terminal) return;
      // Default values
      let col = 1;
      let viewportRow = 1;
      let row = 1;
      let char = "";

      try {
        const buffer = terminal.buffer?.active;
        if (!buffer) {
          this.stateManager.updateCursorPosition({
            char: char,
            viewport: { row: viewportRow, col: col },
            row: row,
            col: col,
          });
          return;
        }
        const cursorX = buffer.cursorX; // 0-based column in viewport
        const cursorYViewport = buffer.cursorY; // 0-based row in viewport
        const viewportY = buffer.viewportY; // top of viewport absolute 0-based
        const cursorYAbsolute = cursorYViewport + viewportY; // absolute row in buffer

        col = cursorX + 1; // 1-based for display
        viewportRow = cursorYViewport + 1; // 1-based within viewport
        row = cursorYAbsolute + 1; // 1-based within viewport

        // Get character under cursor if present (use absolute row)
        const line = buffer.getLine(cursorYAbsolute);
        const cell = line?.getCell(cursorX);
        const ch = cell?.getChars();
        if (typeof ch === "string" && ch.length > 0) {
          char = ch;
        }
      } catch {
        // ignore errors and keep defaults
      }
      this.stateManager.updateCursorPosition({
        char: char,
        viewport: { row: viewportRow, col: col },
        row: row,
        col: col,
      });
    });

    return this;
  }
}
