import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";
import {Clipboard} from "../../../_tauri/clipboard";
import {IDisposable as IXtermDisposable} from "@xterm/xterm";
import {TerminalStateManager} from "../state";
import { Char } from "../../../common/chars/chars";
import {IPty} from "../pty/pty";

export class InputHandler implements ITerminalHandler {

    private _terminal?: Terminal;
    private subscription: Subscription = new Subscription();
    private terminalInputDisposable?: IXtermDisposable;

    constructor(
        private _bus: AppBus,
        private _terminalId: TerminalId,
        private stateManager: TerminalStateManager,
        private pty: IPty
    ) {

    }

    dispose(): void {
        this.terminalInputDisposable?.dispose();
        this.terminalInputDisposable = undefined;
        if(!this.subscription) return;
        this.subscription.unsubscribe();
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearBuffer'}).subscribe(event => {
            if(event.payload !== this._terminalId) return;
            this._terminal?.clear();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'Paste'}).subscribe(async event => {
            if(event.payload !== this._terminalId) return;
            this._terminal?.input(await Clipboard.readText());
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'InjectTerminalInput'}).subscribe(event => {
            if(event.payload?.terminalId !== this._terminalId) return;
            this.pty.write(event.payload.text);
            if(event.payload.appendNewline) {
                setTimeout(() => this.pty.write(Char.Enter), 500);
            }
        }));
        this.terminalInputDisposable = terminal.onData(() => {
            this.stateManager.clearUnreadNotification();
        });
        return this;
    }
}
