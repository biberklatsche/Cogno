import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {IDisposable} from "../../../common/models/models";

export class InputHandler implements ITerminalHandler {

    private _terminal?: Terminal;

    constructor() {

    }

    dispose(): void {

    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        return this;
    }

    write(text: string): void {
        this._terminal?.input(text);
    }
}
