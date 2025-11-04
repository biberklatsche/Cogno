import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {AppBus, MessageBase} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {debounceTime, Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";

export type TerminalFocusedEvent = MessageBase<"TerminalFocused", TerminalId>;

export class FocusHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private _terminal?: Terminal;
    private _hasFocus: boolean = false;

    constructor(private _terminalId: TerminalId, private _bus: AppBus) {

    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({
            path: ['app', 'terminal'],
            type: 'FocusTerminal'
        }).subscribe(event => {
            if(event.payload !== this._terminalId) return;
            event.propagationStopped = true;
            this.focus();
        }));
        this.subscription.add(this._bus.onType$('TerminalFocused').subscribe(event => {
            if(event.payload === this._terminalId) return;
            this.blur();
        }));
        return this;
    }

    focus() {
        this._terminal?.focus();
        this._hasFocus = true;
        this._bus.publish({type: "TerminalFocused", payload: this._terminalId})
    }

    blur() {
        console.info("Focus handler blur", this._terminalId);
        this._terminal?.blur();
        this._terminal?.element?.blur();
        this._terminal?.textarea?.blur();
        this._hasFocus = false;
    }

    hasFocus() {
        return this._hasFocus;
    }
}
