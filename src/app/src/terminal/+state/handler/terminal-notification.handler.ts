import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {ITerminalHandler} from "./handler";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalStateManager} from "../state";
import {NotificationChannels} from "../../../notification/+bus/events";

export class TerminalNotificationHandler implements ITerminalHandler {
    private _disposables?: IDisposable[] = undefined;

    constructor(
        private readonly bus: AppBus,
        private readonly stateManager: TerminalStateManager,
        private readonly channelResolver?: () => NotificationChannels,
    ) {}

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser.registerOscHandler(9, (data: string) => {
            const message = (data ?? "").replace(/\r/g, "").replace(/\n+/g, " ").trim();
            if (!message) return true;

            const channels = this.channelResolver?.();
            if (channels && !channels.app && !channels.os && !channels.telegram) {
                return true;
            }
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
                    channels,
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
