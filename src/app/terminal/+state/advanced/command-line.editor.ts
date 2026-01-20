import {ITerminalHandler} from '../handler/handler';
import {Terminal} from '@xterm/xterm';
import {IDisposable} from '../../../common/models/models';
import {AppBus} from '../../../app-bus/app-bus';
import {Subscription} from 'rxjs';
import {TerminalId} from '../../../grid-list/+model/model';
import {IPty} from '../pty/pty';

export class CommandLineEditor implements ITerminalHandler  {
    private _terminal?: Terminal;
    private subscription: Subscription = new Subscription();

    constructor(private _bus: AppBus, private _pty: IPty, private _terminalId: TerminalId) {
    }

    dispose(): void {
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearLine'}).subscribe(async event => {
            if(event.payload !== this._terminalId) return;
            this.clearCurrentInput();
        }));
        return this;
    }

    private findLastPromptLineIndex(): number {
        let lastPromptLineIndex = -1;
        if(!this._terminal) return lastPromptLineIndex;
        if(!this._terminal.buffer.active) return lastPromptLineIndex;
        for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
            const line = this._terminal.buffer.active.getLine(i);
            if (line && line.translateToString().startsWith('COGNO')) {
                lastPromptLineIndex = i;
                break;
            }
        }
        return lastPromptLineIndex;
    }

    clearCurrentInput() {
        if(!this._terminal) return;
        const buffer = this._terminal.buffer.active;
        const cursorY = buffer.cursorY;
        const cursorX = buffer.cursorX;

        // Finde Start (COGNO-Zeile)
        let startLine = -1;
        for (let i = cursorY; i >= Math.max(0, cursorY - 50); i--) {
            const line = buffer.getLine(i);
            if (line) {
                const text = line.translateToString(true);
                if (text.startsWith('COGNO')) {
                    startLine = i + 1;
                    break;
                }
            }
        }

        if (startLine === -1) return; // Kein COGNO gefunden

        // Berechne zu löschende Zeichen
        let charsToDelete = 0;
        for (let i = startLine; i <= cursorY; i++) {
            const line = buffer.getLine(i);
            if (line) {
                const text = line.translateToString(true).trimEnd();
                if (i === startLine) {
                    charsToDelete += Math.max(0, text.length);
                } else {
                    charsToDelete += text.length;
                }
            }
        }
        console.log('##########', charsToDelete);
        // Methode 1: Cursor ans Ende + Backspace (universell)
        this._pty.write(`${String.fromCharCode(27)}[F`); // Nach rechts
    }
}
