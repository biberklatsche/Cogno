import {AppMessage} from '../../../app-bus/messages';
import {ITerminalHandler} from '../handler/handler';
import {Terminal} from '@xterm/xterm';
import {IDisposable} from '../../../common/models/models';
import {AppBus} from '../../../app-bus/app-bus';
import {Subscription} from 'rxjs';
import {IPty} from '../pty/pty';
import {TerminalStateManager} from "../state";
import {Clipboard} from "../../../_tauri/clipboard";

export class CommandLineEditor implements ITerminalHandler  {
    private _terminal?: Terminal;
    private subscription: Subscription = new Subscription();
    private _onSelectionChange?: IDisposable;
    private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";
    private _selectionStart: number | null = null;

    constructor(private _bus: AppBus, private _pty: IPty, private stateManager: TerminalStateManager) {
    }

    dispose(): void {
        this.subscription.unsubscribe();
        this._onSelectionChange?.dispose();
        this._onSelectionChange = undefined;
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        
        this._onSelectionChange = terminal.onSelectionChange(() => {
            if (this._terminal && !this._terminal.hasSelection()) {
                this._selectionStart = null;
            }
        });

        terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            if (event.type !== 'keydown') return true;
            if (event.key === 'Enter' && event.shiftKey) {
                this._ptyWrite(String.fromCharCode(10));
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            if (this.stateManager.isCommandRunning) return true;
            if ((event.key === 'Backspace' || event.key === 'Delete') && this._terminal?.hasSelection()) {
                return !this.deleteSelection();
            }
            return true;
        });

        const actions: Record<string, (event: any) => void> = {
            'ClearLine': () => this.clearCurrentInput(),
            'ClearLineToEnd': () => this.clearLineToEnd(),
            'ClearLineToStart': () => this.clearLineToStart(),
            'DeletePreviousWord': () => this.deletePreviousWord(),
            'DeleteNextWord': () => this.deleteNextWord(),
            'GoToNextWord': () => this.goToNextWord(),
            'GoToPreviousWord': () => this.goToPreviousWord(),
            'SelectAll': () => this.selectAll(),
            'SelectTextRight': () => this.selectTextRight(),
            'SelectTextLeft': () => this.selectTextLeft(),
            'SelectWordRight': () => this.selectWordRight(),
            'SelectWordLeft': () => this.selectWordLeft(),
            'SelectTextToEndOfLine': () => this.selectTextToEndOfLine(),
            'SelectTextToStartOfLine': () => this.selectTextToStartOfLine(),
            'Cut': () => this.cutSelection(),
        } satisfies Partial<Record<AppMessage['type'], (event: any) => void>>;

        Object.entries(actions).forEach(([key, handler]) => {
            const type = key as AppMessage['type'];
            this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type }).subscribe(async event => {
                if (event.payload !== this.stateManager.terminalId || this.stateManager.isCommandRunning) return;
                
                // Reset selection start for non-selection actions
                if (!type.startsWith('Select')) {
                    this._selectionStart = null;
                }
                
                handler(event);
            }));
        });

        return this;
    }

    /**
     * Clears the entire current input line.
     */
    clearCurrentInput() {
        if(!this._terminal) return;
        const input = this.stateManager.input;
        const text = input.text;
        const countToEnd = text.length - input.cursorIndex;
        this._ptyWrite(this._buildCursorMoveCommand(countToEnd) + String.fromCharCode(8).repeat(text.length));
    }

    /**
     * Clears the line from the current cursor position to the end.
     */
    clearLineToEnd() {
        const input = this.stateManager.input;
        const countToEnd = input.text.length - input.cursorIndex;
        if (countToEnd > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToEnd) + String.fromCharCode(8).repeat(countToEnd));
        }
    }

    /**
     * Clears the line from the current cursor position to the start.
     */
    clearLineToStart() {
        const input = this.stateManager.input;
        const countToStart = input.cursorIndex;
        if (countToStart > 0) {
            this._ptyWrite(String.fromCharCode(8).repeat(countToStart));
        }
    }

    /**
     * Deletes the word immediately preceding the cursor.
     */
    deletePreviousWord() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        if (currentPos === 0) return;

        const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
        const countToDelete = currentPos - prevWordStart;

        if (countToDelete > 0) {
            this._ptyWrite(String.fromCharCode(8).repeat(countToDelete));
        }
    }

    /**
     * Deletes the word immediately following the cursor.
     */
    deleteNextWord() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        const text = input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToDelete = nextWordEnd - currentPos;

        if (countToDelete > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToDelete) + String.fromCharCode(8).repeat(countToDelete));
        }
    }

    /**
     * Moves the cursor to the end of the next word.
     */
    goToNextWord() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        const text = input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToMove = nextWordEnd - currentPos;

        if (countToMove > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToMove));
        }
    }

    /**
     * Moves the cursor to the start of the previous word.
     */
    goToPreviousWord() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        if (currentPos === 0) return;

        const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
        const countToMove = currentPos - prevWordStart;

        if (countToMove > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(-countToMove));
        }
    }

    /**
     * Selects one character to the right and moves the cursor.
     */
    selectTextRight() {
        this._selectAndMove(1);
    }

    /**
     * Selects one character to the left and moves the cursor.
     */
    selectTextLeft() {
        this._selectAndMove(-1);
    }

    /**
     * Selects to the end of the next word and moves the cursor.
     */
    selectWordRight() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        const nextWordEnd = this.findNextWordEnd(input.text, currentPos);
        const countToMove = nextWordEnd - currentPos;
        if (countToMove > 0) {
            this._selectAndMove(countToMove);
        }
    }

    /**
     * Selects to the start of the previous word and moves the cursor.
     */
    selectWordLeft() {
        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;
        const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
        const countToMove = currentPos - prevWordStart;
        if (countToMove > 0) {
            this._selectAndMove(-countToMove);
        }
    }

    /**
     * Selects text from the current cursor position to the end of the line.
     */
    selectTextToEndOfLine() {
        const input = this.stateManager.input;
        const countToMove = input.text.length - input.cursorIndex;
        if (countToMove > 0) {
            this._selectAndMove(countToMove);
        }
    }

    /**
     * Selects text from the current cursor position to the start of the line.
     */
    selectTextToStartOfLine() {
        const input = this.stateManager.input;
        const countToMove = input.cursorIndex;
        if (countToMove > 0) {
            this._selectAndMove(-countToMove);
        }
    }

    private selectAll() {
        this._clearSelection();
        this._selectionStart = 0;
        const input = this.stateManager.input;
        const currentCursorIdx = input.cursorIndex;
        const textLength = input.text.length;

        // Move cursor to the end of the line
        const offsetToEnd = textLength - currentCursorIdx;
        this._ptyWrite(this._buildCursorMoveCommand(offsetToEnd));

        // Mark from 0 to textLength
        this.selectAbsolute(0, textLength);
    }

    private selectAbsolute(start: number, end: number) {
        if (!this._terminal) return;
        const length = Math.abs(end - start);
        const actualStart = Math.min(start, end);

        const startInputY = this.findLastCognoMarkerY() + 1;
        const startCol = actualStart % this._terminal.cols;
        const startRow = startInputY + Math.floor(actualStart / this._terminal.cols);

        this._terminal.select(startCol, startRow, length);
    }

    private _selectAndMove(offset: number) {
        this.select(offset);
        this._ptyWrite(this._buildCursorMoveCommand(offset));
    }

    private _ptyWrite(data: string) {
        if (!this._terminal) return;
        this._pty.write(data);
    }

    private cutSelection() {
        if (!this._terminal?.hasSelection()) return;
        
        const selectionText = this._terminal.getSelection();
        if (selectionText) {
            Clipboard.writeText(selectionText);
        }
        this.deleteSelection();
    }

    private deleteSelection(): boolean {
        if (!this._terminal) return false;

        const selection = this._terminal.getSelectionPosition();
        if (!selection) return false;

        const lastCognoY = this.findLastCognoMarkerY();
        const startInputY = lastCognoY + 1;
        const cols = this._terminal.cols;

        // Selection coordinates are 0-based
        // Convert to 0-based index relative to start of input
        const startIdx = (selection.start.y - startInputY) * cols + selection.start.x;
        const endIdx = (selection.end.y - startInputY) * cols + selection.end.x;

        // Check if selection is within input range
        const input = this.stateManager.input;
        if (startIdx < 0 || endIdx > input.maxCursorIndex) {
            // Selection is at least partially outside of input area
            console.warn('Selection is outside of input area', startIdx, endIdx);
            return false;
        }

        const deleteLength = endIdx - startIdx;
        if (deleteLength <= 0) {
            this._clearSelection();
            return true;
        }

        const currentCursorIdx = input.cursorIndex;
        const cursorOffsetToEnd = endIdx - currentCursorIdx;

        // Position cursor at the end of selection, then delete back
        this._ptyWrite(this._buildCursorMoveCommand(cursorOffsetToEnd) + String.fromCharCode(8).repeat(deleteLength));
        this._clearSelection();
        return true;
    }

    /**
     * Creates a cursor movement command for the terminal.
     * @param offset Number of positions (positive = right, negative = left).
     */
    private _buildCursorMoveCommand(offset: number): string {
        if (offset === 0) {
            return '';
        }

        const escapeCode = String.fromCharCode(27);
        const direction = offset > 0 ? 'C' : 'D'; // C = right, D = left
        const count = Math.abs(offset);

        return `${escapeCode}[${direction}`.repeat(count);
    }

    /**
     * Resets the current selection.
     */
    private _clearSelection() {
        this._selectionStart = null;
        this._terminal?.clearSelection();
    }

    /**
     * Expands or shrinks the selection by the given number of characters.
     * @param count The number of characters to change the selection by.
     */
    private select(count: number) {
        if(!this._terminal) return;
        const lastCognoY = this.findLastCognoMarkerY();
        if (lastCognoY === -1 && this._terminal.buffer.active) {
            // If no marker found but buffer exists, we might still want to avoid selection if it's meant to be input-only
            // but let's stick to current behavior of allowing it from top if no marker.
            // HOWEVER, the test expects NO call if buffer.active is null.
        }
        if (!this._terminal.buffer.active) return;

        const input = this.stateManager.input;
        const currentPos = input.cursorIndex;

        if (this._selectionStart === null) {
            // If no internal selection is active, check if there is an external one
            const selection = this._terminal.getSelectionPosition();
            if (selection) {
                // Convert external selection to cursorIndex
                const lastCognoY = this.findLastCognoMarkerY();
                const startInputY = lastCognoY + 1;
                const cols = this._terminal.cols;
                
                // We assume the selection started or ended at the cursor
                // To be sure, we set _selectionStart to the point that is NOT the current cursor position
                const startIdx = (selection.start.y - startInputY) * cols + selection.start.x;
                const endIdx = (selection.end.y - startInputY) * cols + selection.end.x;
                
                // If the cursor is at the end, the start was the fixed point
                if (Math.abs(currentPos - endIdx) < Math.abs(currentPos - startIdx)) {
                    this._selectionStart = startIdx;
                } else {
                    this._selectionStart = endIdx;
                }
            } else {
                this._selectionStart = currentPos;
            }
        }

        const newPos = Math.max(0, Math.min(input.text.length, currentPos + count));
        const start = Math.min(this._selectionStart, newPos);
        const length = Math.abs(newPos - this._selectionStart);

        const startInputY = this.findLastCognoMarkerY() + 1;
        const startCol = start % this._terminal.cols;
        const startRow = startInputY + Math.floor(start / this._terminal.cols);

        this._terminal.select(startCol, startRow, length);
    }

    private findLastCognoMarkerY(): number {
        let lastPromptRow = -1;
        if(!this._terminal?.buffer?.active) return lastPromptRow;
        for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
            const line = this._terminal.buffer.active.getLine(i);
            if (line && line.translateToString().startsWith('^^#')) {
                lastPromptRow = i;
                break;
            }
        }
        return lastPromptRow;
    }

    private findPreviousWordStart(text: string, currentPos: number): number {
        let pos = currentPos - 1;
        // Skip trailing separators
        while (pos >= 0 && this.WORD_SEPARATORS.includes(text[pos])) {
            pos--;
        }
        // Find start of word
        while (pos >= 0 && !this.WORD_SEPARATORS.includes(text[pos])) {
            pos--;
        }
        return pos + 1;
    }

    private findNextWordEnd(text: string, currentPos: number): number {
        let pos = currentPos;
        // Skip leading separators
        while (pos < text.length && this.WORD_SEPARATORS.includes(text[pos])) {
            pos++;
        }
        // Find end of word
        while (pos < text.length && !this.WORD_SEPARATORS.includes(text[pos])) {
            pos++;
        }
        return pos;
    }
}
