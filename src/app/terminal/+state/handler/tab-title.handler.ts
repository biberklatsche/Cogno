import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus, MessageBase} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {ITerminalHandler} from "./handler";

export type TabTitle = {
    terminalId: TerminalId;
    title: string;
}
export type TabTitleChangedEvent = MessageBase<"TabTitleChanged", TabTitle>;

export class TabTitleHandler implements ITerminalHandler{

    private _disposables?: IDisposable[] = undefined;

    constructor(private _terminalId: TerminalId, private _bus: AppBus) {
    }

    register(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser
            .registerOscHandler(0, (title: string) => {
                this._bus.publish({type: "TabTitleChanged", payload: {terminalId: this._terminalId, title}})
                return true;
            }));
        this._disposables.push(terminal.parser
            .registerOscHandler(2, (title: string) => {
                this._bus.publish({type: "TabTitleChanged", payload: {terminalId: this._terminalId, title}})
                return true;
            }));
        return this;
    }

    dispose(): void {
        if (this._disposables) {
            this._disposables.forEach(d => d.dispose());
            this._disposables = undefined;
        }
    }
}
