import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {Clipboard} from "../../../_tauri/clipboard";
import {ConfigService} from "../../../config/+state/config.service";

export class SelectionHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private _terminal?: Terminal;

    constructor(private _bus: AppBus, private _configService: ConfigService, private _terminalId: TerminalId) {

    }

    dispose(): void {
        this.subscription.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._bus.on$({path: ['app', 'terminal'], type: 'Copy'}).subscribe(async event => {
            if(event.payload !== this._terminalId || !this.hasSelection()) return;
            console.log("copy");
            await Clipboard.writeText(this.getSelection());
            if (this._configService.config.selection?.clear_on_copy) {
                this.clearSelection();
            }
        }));
        return this;
    }

    hasSelection(): boolean {
        return this._terminal?.hasSelection() ?? false;
    }

    getSelection(): string {
        return this._terminal?.getSelection() ?? '';
    }

    clearSelection(): void {
        this._terminal?.clearSelection();
    }
}
