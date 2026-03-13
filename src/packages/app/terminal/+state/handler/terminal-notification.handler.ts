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
            if (this.tryHandleProgress(data)) {
                return true;
            }

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

    private tryHandleProgress(data: string | undefined): boolean {
        const match = /^\s*4;([^;]*)(?:;(.*))?\s*$/.exec(data ?? "");
        if (!match) {
            return false;
        }

        const state = Number.parseInt(match[1] ?? "", 10);
        const progress = Number.parseInt(match[2] ?? "0", 10);

        switch (state) {
            case 0:
                this.stateManager.setProgress("hidden", 0);
                return true;
            case 1:
                this.stateManager.setProgress("default", progress);
                return true;
            case 2:
                this.stateManager.setProgress("error", progress);
                return true;
            case 3:
                this.stateManager.setProgress("indeterminate", 0);
                return true;
            case 4:
                this.stateManager.setProgress("warning", progress);
                return true;
            default:
                return false;
        }
    }

    dispose(): void {
        if (this._disposables) {
            this._disposables.forEach(d => d.dispose());
            this._disposables = undefined;
        }
    }
}
