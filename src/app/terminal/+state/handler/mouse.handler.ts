import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {TerminalStateManager} from "../state";

/**
 * Tracks the current terminal cell (col,row)
 * under the mouse while moving over the terminal container.
 */
export class MouseHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private readonly _screenElement?: HTMLElement;
  private _listener?: (e: MouseEvent) => void;
  private _lastCol?: number;
  private _lastRow?: number;

  constructor(private _terminalContainer: HTMLDivElement, private _stateManager: TerminalStateManager) {
      this._screenElement = this._terminalContainer.querySelector('.xterm-screen') as HTMLElement;
  }

  dispose(): void {
    if (this._listener) {
      this._screenElement?.removeEventListener('mousemove', this._listener);
      this._listener = undefined;
    }
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this._lastCol = undefined;
    this._lastRow = undefined;
    this._listener = (evt: MouseEvent) => {
      if (!this._terminal || !this._screenElement) return;
      const rect = this._screenElement.getBoundingClientRect();
      const cols = this._terminal.cols || 0;
      const rows = this._terminal.rows || 0;
      if (cols <= 0 || rows <= 0 || rect.width <= 0 || rect.height <= 0) return;

      const relX = evt.clientX - rect.left;
      const relY = evt.clientY - rect.top;

      const cellW = Math.floor(rect.width / cols);
      const cellH = Math.floor(rect.height / rows);

      let col = Math.floor(relX / cellW) + 1;
      let row = Math.floor(relY / cellH) + 1;

      // clamp to terminal bounds
      if (col < 1) col = 1; else if (col > cols) col = cols;
      if (row < 1) row = 1; else if (row > rows) row = rows;

      if (this._lastCol === col && this._lastRow === row) {
        return;
      }

      this._lastCol = col;
      this._lastRow = row;

      const buffer = this._terminal.buffer.active as any;
      const absRow = (buffer.viewportY ?? 0) + (row - 1);
      // Try to read the character under the mouse from xterm's buffer
      let char = '';
      try {

        // 0-based absolute row in buffer
        const line = buffer.getLine?.(absRow);
        const cell = line?.getCell?.(col - 1);
        const ch = cell?.getChars?.();
        char = typeof ch === 'string' ? ch : '';
      } catch {
        // ignore, keep empty char
      }

      this._stateManager.updateMousePosition({
        viewport: {col: col, row: row},
        col: col,
        row: absRow + 1,
        char: char
      });
    };

    this._screenElement?.addEventListener('mousemove', this._listener, { passive: true });

    return this;
  }
}
