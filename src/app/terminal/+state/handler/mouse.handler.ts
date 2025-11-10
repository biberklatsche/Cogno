import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";

/**
 * Publishes inspector events with the current terminal cell (col,row)
 * under the mouse while moving over the terminal container.
 */
export class MouseHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _listener?: (e: MouseEvent) => void;

  constructor(private _bus: AppBus, private _terminalContainer: HTMLDivElement, private _terminalId: TerminalId) {}

  dispose(): void {
    if (this._listener) {
      this._terminalContainer.removeEventListener('mousemove', this._listener);
      this._listener = undefined;
    }
  }

  register(terminal: Terminal, _fit?: FitAddon): IDisposable {
    this._terminal = terminal;

    this._listener = (evt: MouseEvent) => {
      if (!this._terminal) return;
      const rect = this._terminalContainer.getBoundingClientRect();
      const cols = this._terminal.cols || 0;
      const rows = this._terminal.rows || 0;
      if (cols <= 0 || rows <= 0 || rect.width <= 0 || rect.height <= 0) return;

      const relX = evt.clientX - rect.left;
      const relY = evt.clientY - rect.top;

      const cellW = Math.floor(rect.width / cols);
      const cellH = Math.floor(rect.height / rows);

      let col = Math.floor(relX / cellW); // 1-based
      let row = Math.floor(relY / cellH); // 1-based

      // clamp to terminal bounds
      if (col < 1) col = 1; else if (col > cols) col = cols;
      if (row < 1) row = 1; else if (row > rows) row = rows;

      // Try to read the character under the mouse from xterm's buffer
      let char = '';
      try {
        const buffer = this._terminal.buffer.active as any;
        const absRow = (buffer.viewportY ?? 0) + (row - 1); // 0-based absolute row in buffer
        const line = buffer.getLine?.(absRow);
        const cell = line?.getCell?.(col - 1);
        const ch = cell?.getChars?.();
        char = typeof ch === 'string' ? ch : '';
      } catch {
        // ignore, keep empty char
      }

      this._bus.publish({
        path: ['inspector'],
        type: 'Inspector',
        payload: { type: 'terminal-mouse-position', data: { terminalId: this._terminalId, col, row, char } }
      });
    };

    this._terminalContainer.addEventListener('mousemove', this._listener, { passive: true });

    return this;
  }
}
