import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";
import {Clipboard} from "../../../_tauri/clipboard";

export class InputHandler implements ITerminalHandler {

    private _terminal?: Terminal;
    private subscription: Subscription = new Subscription();

    constructor(private _bus: AppBus, private _terminalId: TerminalId) {

    }

    dispose(): void {
        if(!this.subscription) return;
        this.subscription.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'ClearBuffer'}).subscribe(event => {
            if(event.payload !== this._terminalId) return;
            this._terminal?.clear();
        }));
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'Paste'}).subscribe(async event => {
            if(event.payload !== this._terminalId) return;
            this._terminal?.input(await Clipboard.readText());
        }));
        return this;
    }
}
