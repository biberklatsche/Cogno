import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";

export class FocusHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private _terminal?: Terminal;

    constructor(private _terminalId: TerminalId, private _bus: AppBus) {

    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({
            path: ['app', 'terminal', this._terminalId],
            type: 'FocusTerminalCommand'
        }).subscribe(event => {
            event.propagationStopped = true;
            this._terminal?.focus();
        }));
        return this;
    }

}
