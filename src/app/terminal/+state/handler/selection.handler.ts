import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";

export class SelectionHandler implements ITerminalHandler {

    private subscription: Subscription = new Subscription();
    private _terminal?: Terminal;

    constructor() {

    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._terminal.onSelectionChange((event) => {

            console.log("selection change", event);
        });
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
