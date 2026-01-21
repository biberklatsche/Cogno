import {AppMessage} from '../../../app-bus/messages';
import {ITerminalHandler} from '../handler/handler';
import {Terminal} from '@xterm/xterm';
import {IDisposable} from '../../../common/models/models';
import {AppBus} from '../../../app-bus/app-bus';
import {Subscription} from 'rxjs';
import {TerminalId} from '../../../grid-list/+model/model';
import {IPty} from '../pty/pty';
import {InternalState} from "../session.state";

export class CommandLineEditor implements ITerminalHandler  {
    private _terminal?: Terminal;
    private subscription: Subscription = new Subscription();
    private onKey?: IDisposable;
    private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";
    private _selectionStart: number | null = null;

    constructor(private _bus: AppBus, private _pty: IPty, private sessionState: InternalState) {
    }

    dispose(): void {
        this.subscription.unsubscribe();
        this.onKey?.dispose();
        this.onKey = undefined;
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.onKey = terminal.onKey(() => {
            this._selectionStart = null;
        });

        terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            if (this.sessionState.isCommandRunning) return true;
            if (event.type !== 'keydown') return true;

            if ((event.key === 'Backspace' || event.key === 'Delete') && this._selectionStart !== null) {
                this.deleteSelection();
                return false;
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
            'SelectTextRight': () => this.selectTextRight(),
            'SelectTextLeft': () => this.selectTextLeft(),
            'SelectWordRight': () => this.selectWordRight(),
            'SelectWordLeft': () => this.selectWordLeft(),
            'SelectTextToEndOfLine': () => this.selectTextToEndOfLine(),
            'SelectTextToStartOfLine': () => this.selectTextToStartOfLine(),
        } satisfies Partial<Record<AppMessage['type'], (event: any) => void>>;

        Object.entries(actions).forEach(([key, handler]) => {
            const type = key as AppMessage['type'];
            this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type }).subscribe(async event => {
                if (event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
                
                // Reset selection start for non-selection actions
                if (!type.startsWith('Select')) {
                    this._selectionStart = null;
                }
                
                handler(event);
            }));
        });

        return this;
    }

    clearCurrentInput() {
        if(!this._terminal) return;
        const text = this.sessionState.input.text;
        const countToEnd = text.length - this.sessionState.input.cursorIndex;
        this._ptyWrite(this._buildCursorMoveCommand(countToEnd) + "\x08".repeat(text.length));
    }

    clearLineToEnd() {
        const countToEnd = this.sessionState.input.text.length - this.sessionState.input.cursorIndex;
        if (countToEnd > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToEnd) + "\x08".repeat(countToEnd));
        }
    }

    clearLineToStart() {
        const countToStart = this.sessionState.input.cursorIndex;
        if (countToStart > 0) {
            this._ptyWrite("\x08".repeat(countToStart));
        }
    }

    deletePreviousWord() {
        const currentPos = this.sessionState.input.cursorIndex;
        if (currentPos === 0) return;

        const prevWordStart = this.findPreviousWordStart(this.sessionState.input.text, currentPos);
        const countToDelete = currentPos - prevWordStart;

        if (countToDelete > 0) {
            this._ptyWrite("\x08".repeat(countToDelete));
        }
    }

    deleteNextWord() {
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToDelete = nextWordEnd - currentPos;

        if (countToDelete > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToDelete) + "\x08".repeat(countToDelete));
        }
    }

    goToNextWord() {
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToMove = nextWordEnd - currentPos;

        if (countToMove > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(countToMove));
        }
    }

    goToPreviousWord() {
        const currentPos = this.sessionState.input.cursorIndex;
        if (currentPos === 0) return;

        const prevWordStart = this.findPreviousWordStart(this.sessionState.input.text, currentPos);
        const countToMove = currentPos - prevWordStart;

        if (countToMove > 0) {
            this._ptyWrite(this._buildCursorMoveCommand(-countToMove));
        }
    }

    selectTextRight() {
        this._selectAndMove(1);
    }

    selectTextLeft() {
        this._selectAndMove(-1);
    }

    selectWordRight() {
        const currentPos = this.sessionState.input.cursorIndex;
        const nextWordEnd = this.findNextWordEnd(this.sessionState.input.text, currentPos);
        const countToMove = nextWordEnd - currentPos;
        if (countToMove > 0) {
            this._selectAndMove(countToMove);
        }
    }

    selectWordLeft() {
        const currentPos = this.sessionState.input.cursorIndex;
        const prevWordStart = this.findPreviousWordStart(this.sessionState.input.text, currentPos);
        const countToMove = currentPos - prevWordStart;
        if (countToMove > 0) {
            this._selectAndMove(-countToMove);
        }
    }

    selectTextToEndOfLine() {
        const countToMove = this.sessionState.input.text.length - this.sessionState.input.cursorIndex;
        if (countToMove > 0) {
            this._selectAndMove(countToMove);
        }
    }

    selectTextToStartOfLine() {
        const countToMove = this.sessionState.input.cursorIndex;
        if (countToMove > 0) {
            this._selectAndMove(-countToMove);
        }
    }

    private _selectAndMove(offset: number) {
        this.select(offset);
        this._ptyWrite(this._buildCursorMoveCommand(offset));
    }

    private _ptyWrite(data: string) {
        if (!this._terminal) return;
        this._pty.write(data);
    }

    private deleteSelection() {
        if (!this._terminal || this._selectionStart === null) return;

        const cursorPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;

        const selectionStart = Math.min(this._selectionStart, cursorPos);
        const selectionEnd = Math.max(this._selectionStart, cursorPos);

        if (selectionStart === selectionEnd) {
            this._clearSelection();
            return;
        }

        const deleteEnd = Math.min(selectionEnd, text.length);
        const deleteLength = deleteEnd - selectionStart;

        if (selectionStart >= text.length || deleteLength <= 0) {
            this._clearSelection();
            return;
        }

        const cursorOffset = deleteEnd - cursorPos;
        this._ptyWrite(this._buildCursorMoveCommand(cursorOffset) + "\x08".repeat(deleteLength));
        this._clearSelection();
    }

    /**
     * Erstellt einen Cursor-Bewegungsbefehl für das Terminal
     * @param offset Anzahl Positionen (positiv = rechts, negativ = links)
     */
    private _buildCursorMoveCommand(offset: number): string {
        if (offset === 0) {
            return '';
        }

        const escapeCode = String.fromCharCode(27);
        const direction = offset > 0 ? 'C' : 'D'; // C = rechts, D = links
        const count = Math.abs(offset);

        return `${escapeCode}[${direction}`.repeat(count);
    }

    /**
     * Setzt die Selektion zurück
     */
    private _clearSelection() {
        this._selectionStart = null;
        this._terminal?.clearSelection();
    }

    private select(count: number) {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;

        if (this._selectionStart === null) {
            this._selectionStart = currentPos;
        }

        const newPos = Math.max(0, Math.min(this.sessionState.input.text.length, currentPos + count));
        const start = Math.min(this._selectionStart, newPos);
        const length = Math.abs(newPos - this._selectionStart);

        // Wir brauchen die absolute Position im Buffer.
        // CommandLineObserver berechnet cursorIndex relativ zum Prompt.
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
            if (line && line.translateToString().startsWith('COGNO')) {
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
