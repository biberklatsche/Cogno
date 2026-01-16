import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {AppBus} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {ITerminalHandler} from "../handler/handler";
import {SessionState} from "../session.state";


export class CognoOscHandler implements ITerminalHandler {

    private _disposables?: IDisposable[] = undefined;

    constructor(private _bus: AppBus, private sessionState: SessionState) {
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables = [];
        this._disposables.push(terminal.parser
            .registerOscHandler(733, (title: string) => {
                this.sessionState.isCommandRunning = false;
                console.log("OSC 733: " + title);
                return true;
            }));
        return this;
    }

    dispose(): void {
        if (!this._disposables) return;
        this._disposables.forEach(d => d.dispose());
        this._disposables = undefined;
    }
}
