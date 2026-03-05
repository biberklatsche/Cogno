import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {ITerminalHandler} from "./handler";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalStateManager} from "../state";

export class TerminalNotificationHandler implements ITerminalHandler {
    private _disposables?: IDisposable[] = undefined;

    constructor(private readonly bus: AppBus, private readonly stateManager: TerminalStateManager) {}

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser.registerOscHandler(9, (data: string) => {
            const message = (data ?? "").replace(/\r/g, "").replace(/\n+/g, " ").trim();
            if (!message) return true;
            this.stateManager.markUnreadNotification();

            this.bus.publish({
                type: "Notification",
                path: ["notification"],
                payload: {
                    header: "Terminal Notification",
                    body: message,
                    type: "info",
                    timestamp: new Date(),
                    terminalId: this.stateManager.terminalId,
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
