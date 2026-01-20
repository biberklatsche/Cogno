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
    private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";

    constructor(private _bus: AppBus, private _pty: IPty, private sessionState: InternalState) {
    }

    dispose(): void {
        this.subscription.unsubscribe();
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLine'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.clearCurrentInput();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLineToEnd'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.clearLineToEnd();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLineToStart'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.clearLineToStart();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'DeletePreviousWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.deletePreviousWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'DeleteNextWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.deleteNextWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'GoToNextWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.goToNextWord();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'GoToPreviousWord'}).subscribe(async event => {
            if(event.payload !== this.sessionState.terminalId || this.sessionState.isCommandRunning) return;
            this.goToPreviousWord();
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
