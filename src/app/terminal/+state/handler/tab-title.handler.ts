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

    private readonly OSC_CODE = 0;
    private _disposable?: IDisposable;

    constructor(private _terminalId: TerminalId, private _bus: AppBus) {
    }

    register(terminal: Terminal): IDisposable {
        this._disposable = terminal.parser
            .registerOscHandler(this.OSC_CODE, (title: string) => {
                this._bus.publish({type: "TabTitleChanged", payload: {terminalId: this._terminalId, title}})
                return true;
            });
        return this;
    }

    dispose(): void {
        if (this._disposable) {this._disposable.dispose();}
    }
}
