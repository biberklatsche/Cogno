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
        return this;
    }

    clearCurrentInput() {
        if(!this._terminal) return;
        const countCharsToDelete = this.sessionState.input.text.length;
        const countToEnd = countCharsToDelete - this.sessionState.input.cursorIndex;
        // Methode 1: Cursor ans Ende + Backspace (universell)
        this._pty.write(`${String.fromCharCode(27)}[C`.repeat(countToEnd) + String.fromCharCode(8).repeat(countCharsToDelete)); // Nach rechts
    }
}
