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
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLine'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.clearCurrentInput();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLineToEnd'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.clearLineToEnd();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLineToStart'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.clearLineToStart();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'DeletePreviousWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.deletePreviousWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'DeleteNextWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.deleteNextWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'GoToNextWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.goToNextWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'GoToPreviousWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this._selectionStart = null;
            this.goToPreviousWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectTextRight'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectTextRight();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectTextLeft'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectTextLeft();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectWordRight'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectWordRight();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectWordLeft'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectWordLeft();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectTextToEndOfLine'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectTextToEndOfLine();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'SelectTextToStartOfLine'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.selectTextToStartOfLine();
        }));
        return this;
    }

    clearCurrentInput() {
        if(!this._terminal) return;
        const countCharsToDelete = this.sessionState.input.text.length;
        const countToEnd = countCharsToDelete - this.sessionState.input.cursorIndex;
        // Methode 1: Cursor ans Ende + Backspace (universell)
        this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToEnd) + String.fromCharCode(8).repeat(countCharsToDelete)); // Nach rechts
    }

    clearLineToEnd() {
        if(!this._terminal) return;
        const countToEnd = this.sessionState.input.text.length - this.sessionState.input.cursorIndex;
        if (countToEnd > 0) {
            this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToEnd) + String.fromCharCode(8).repeat(countToEnd)); // Delete character
        }
    }

    clearLineToStart() {
        if(!this._terminal) return;
        const countToStart = this.sessionState.input.cursorIndex;
        if (countToStart > 0) {
            this._pty.write(String.fromCharCode(8).repeat(countToStart));
        }
    }

    deletePreviousWord() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        if (currentPos === 0) return;
        
        const prevWordStart = this.findPreviousWordStart(this.sessionState.input.text, currentPos);
        const countToDelete = currentPos - prevWordStart;
        
        if (countToDelete > 0) {
            this._pty.write(String.fromCharCode(8).repeat(countToDelete));
        }
    }

    deleteNextWord() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToDelete = nextWordEnd - currentPos;

        if (countToDelete > 0) {
            this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToDelete) + String.fromCharCode(8).repeat(countToDelete));
        }
    }

    goToNextWord() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        if (currentPos >= text.length) return;

        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToMove = nextWordEnd - currentPos;

        if (countToMove > 0) {
            this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToMove));
        }
    }

    goToPreviousWord() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        if (currentPos === 0) return;

        const prevWordStart = this.findPreviousWordStart(this.sessionState.input.text, currentPos);
        const countToMove = currentPos - prevWordStart;

        if (countToMove > 0) {
            this._pty.write(`${String.fromCharCode(27)}[D`.repeat(countToMove));
        }
    }

    selectTextRight() {
        if(!this._terminal) return;
        this.select(1);
        this._pty.write(`${String.fromCharCode(27)}[C`);
    }

    selectTextLeft() {
        if(!this._terminal) return;
        this.select(-1);
        this._pty.write(`${String.fromCharCode(27)}[D`);
    }

    selectWordRight() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        const nextWordEnd = this.findNextWordEnd(text, currentPos);
        const countToMove = nextWordEnd - currentPos;
        if (countToMove > 0) {
            this.select(countToMove);
            this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToMove));
        }
    }

    selectWordLeft() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        const prevWordStart = this.findPreviousWordStart(text, currentPos);
        const countToMove = currentPos - prevWordStart;
        if (countToMove > 0) {
            this.select(-countToMove);
            this._pty.write(`${String.fromCharCode(27)}[D`.repeat(countToMove));
        }
    }

    selectTextToEndOfLine() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        const text = this.sessionState.input.text;
        const countToMove = text.length - currentPos;
        if (countToMove > 0) {
            this.select(countToMove);
            this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToMove));
        }
    }

    selectTextToStartOfLine() {
        if(!this._terminal) return;
        const currentPos = this.sessionState.input.cursorIndex;
        if (currentPos > 0) {
            this.select(-currentPos);
            this._pty.write(`${String.fromCharCode(27)}[D`.repeat(currentPos));
        }
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
