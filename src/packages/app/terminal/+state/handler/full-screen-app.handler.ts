import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IDisposable} from "../../../common/models/models";
import {TerminalId} from "../../../grid-list/+model/model";
import {AppBus, MessageBase} from "../../../app-bus/app-bus";
import {TerminalStateManager} from "../state";

export type FullScreenAppEnteredEvent = MessageBase<"FullScreenAppEntered", TerminalId>;
export type FullScreenAppLeavedEvent = MessageBase<"FullScreenAppLeaved", TerminalId>;

export class FullScreenAppHandler implements ITerminalHandler {
    private readonly _disposables: IDisposable[] = [];

    constructor(private _terminalId: TerminalId, private _bus: AppBus, private _stateManager: TerminalStateManager) {
    }

    dispose(): void {
        this._disposables.forEach((disposable) => disposable?.dispose());
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._disposables.push(terminal.parser.registerCsiHandler({final: 't'}, (n) => {
            if (n.length === 3 && n[0] === 22 && n[1] === 0 && n[2] === 0) { // Restore Window (Vim on Gitbash uses this)
                this._stateManager.setInFullScreenMode(true);
                this._bus.publish({type: "FullScreenAppEntered", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            if (n.length === 3 && n[0] === 23 && n[1] === 0 && n[2] === 0) { // Save Window (Vim on Gitbash uses this)
                this._stateManager.setInFullScreenMode(false);
                this._bus.publish({type: "FullScreenAppLeaved", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            return false;
        }));

        this._disposables.push(terminal.parser.registerCsiHandler({prefix: '?', final: 'h'}, (n) => {
            if(n.length === 1 && n[0] === 1049) { // alternate screen buffer (vim uses this)
                this._stateManager.setInFullScreenMode(true);
                this._bus.publish({type: "FullScreenAppEntered", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            if(n.length === 2 && n[0] === 1003 && n[1] === 1006) {  // enable mouse tracking (helix uses this)
                this._stateManager.setInFullScreenMode(false);
                this._bus.publish({type: "FullScreenAppLeaved", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            return false;
        }));
        this._disposables.push(terminal.parser.registerCsiHandler({prefix: '?', final: 'l'}, (n) => {
            if(n.length === 2 && n[0] === 1003 && n[1] === 1006) { // disable mouse tracking (helix uses this)
                this._stateManager.setInFullScreenMode(true);

                this._bus.publish({type: "FullScreenAppEntered", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            if(n.length === 1 && n[0] === 1049) { // back to normal screen buffer (vim uses this)
                this._stateManager.setInFullScreenMode(false);

                this._bus.publish({type: "FullScreenAppLeaved", path: ['app', 'terminal', this._terminalId], payload: this._terminalId});
            }
            return false;
        }));
        return this;
    }

}


