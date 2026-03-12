import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {Clipboard} from "../../../_tauri/clipboard";
import {ConfigService} from "../../../config/+state/config.service";
import {TerminalStateManager} from "../state";

export class SelectionHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private terminal?: Terminal;

    constructor(
        private bus: AppBus,
        private configService: ConfigService,
        private terminalId: TerminalId,
        private terminalStateManager: TerminalStateManager
    ) {

    }

    dispose(): void {
        this.subscription.unsubscribe();
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this.terminal = terminal;
        this.syncSelectionState();
        const selectionDisposable = this.terminal.onSelectionChange(() => {
            this.syncSelectionState();
        });
        this.subscription.add(() => selectionDisposable.dispose());
        this.subscription.add(this.bus.on$({path: ['app', 'terminal'], type: 'Copy'}).subscribe(async event => {
            if(event.payload !== this.terminalId || !this.hasSelection()) return;
            await Clipboard.writeText(this.getSelection());
            if (this.configService.config.selection?.clear_on_copy) {
                this.clearSelection();
            }
        }));
        return this;
    }

    hasSelection(): boolean {
        return this.terminal?.hasSelection() ?? false;
    }

    getSelection(): string {
        return this.terminal?.getSelection() ?? '';
    }

    clearSelection(): void {
        this.terminal?.clearSelection();
        this.syncSelectionState();
    }

    private syncSelectionState(): void {
        this.terminalStateManager.setHasSelection(this.hasSelection());
    }
}
