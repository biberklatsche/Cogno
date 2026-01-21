import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {AppBus, MessageBase} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";
import {SessionState} from "../session.state";

export type TerminalFocusedEvent = MessageBase<"TerminalFocused", TerminalId>;
export type TerminalBlurredEvent = MessageBase<"TerminalBlurred", TerminalId>;

export class FocusHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private _terminal?: Terminal;

    constructor(private _terminalId: TerminalId, private _bus: AppBus, private _sessionState: SessionState) {

    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({
            path: ['app', 'terminal'],
            type: 'FocusTerminal'
        }).subscribe(event => {
            if (event.payload === this._terminalId){
                this.focus();
            } else {
                this.blur();
            }
        }));

        this.subscription.add(this._bus.on$({
            path: ['app', 'terminal', this._terminalId],
            type: 'PtyInitialized'
        }).subscribe(event => {
            this.focus();
        }));

        this.subscription.add(this._bus.on$({
            path: ['app', 'terminal'],
            type: 'BlurTerminal'
        }).subscribe(event => {
            if (event.payload === this._terminalId){
                this.blur();
            }
        }));

        const textarea = terminal.textarea;
        textarea?.addEventListener("focus", () => {
            this._sessionState.isFocused = true;
        });
        textarea?.addEventListener("blur", () => {
            this._sessionState.isFocused = false
        });

        return this;
    }

    focus() {
        this._terminal?.focus();
        this._sessionState.isFocused = true;
        this._bus.publish({type: "TerminalFocused", payload: this._terminalId});
    }

    blur() {
        this._terminal?.blur();
        this._sessionState.isFocused = false;
        this._bus.publish({type: "TerminalBlurred", payload: this._terminalId});
    }

    hasFocus() {
        return this._sessionState.isFocused;
    }
}
