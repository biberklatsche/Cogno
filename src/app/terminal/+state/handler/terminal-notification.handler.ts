import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {ITerminalHandler} from "./handler";
import {AppBus} from "../../../app-bus/app-bus";

export class TerminalNotificationHandler implements ITerminalHandler {
    private _disposables?: IDisposable[] = undefined;

    constructor(private readonly bus: AppBus) {}

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser.registerOscHandler(9, (data: string) => {
            console.log('################### TerminalNotificationHandler9', {data});
            const message = (data ?? "").replace(/\r/g, "").replace(/\n+/g, " ").trim();
            if (!message) return true;

            this.bus.publish({
                type: "Notification",
                path: ["notification"],
                payload: {
                    header: "Terminal Notification",
                    body: message,
                    type: "info",
                    timestamp: new Date(),
                }
            });
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
