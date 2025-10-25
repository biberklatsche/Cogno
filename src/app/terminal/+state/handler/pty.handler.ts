import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {TerminalId} from "../../../grid-list/+model/model";
import {ConfigService} from "../../../config/+state/config.service";
import {Pty} from "../../../_tauri/pty";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";

export class PtyHandler implements ITerminalHandler {

    private _pty = new Pty();
    private readonly _disposables: IDisposable[] = [];

    constructor(private _terminalId: TerminalId, private _configService: ConfigService, private bus: AppBus) {}

    dispose(): void {
        this._pty.kill();
        this._disposables.forEach((disposable) => disposable?.dispose());
    }

    register(terminal: Terminal): IDisposable {
        this.spawnPty(this._terminalId).then(_ => {
            this._disposables.push(terminal.onData(data => this._pty?.write(data)));
            this._disposables.push(this._pty?.onData(data => terminal?.write(data)));
            this.bus.publish({type: "TerminalInitializedEvent", payload: this._terminalId});
        });
        return this;
    }

    private spawnPty(terminalId: TerminalId) {
        const shellConfig = this._configService.config.shell[1]!;
        return this._pty.spawn(terminalId, shellConfig);
    }

}
