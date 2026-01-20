import {ITerminalHandler} from '../handler/handler';
import {Terminal} from '@xterm/xterm';
import {IDisposable} from '../../../common/models/models';
import {AppBus} from '../../../app-bus/app-bus';

export class CommandLineEditor implements ITerminalHandler  {
    private _terminal?: Terminal

    constructor(private appBus: AppBus) {
        this.appBus.
    }

    dispose(): void {
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        return this;
    }
}
