import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {TerminalId} from "../../../grid-list/+model/model";
import {ConfigService} from "../../../config/+state/config.service";
import {IPty} from "../pty/pty";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";

export class PtyHandler implements ITerminalHandler {

    private _resizeObserver: ResizeObserver | undefined = undefined;
    private _resizeRaf?: number;
    private readonly _disposables: IDisposable[] = [];

    constructor(
        private _terminalId: TerminalId,
        private _pty: IPty,
        private _configService: ConfigService,
        private _bus: AppBus
    ) {}

    dispose(): void {
        this._disposables.forEach((disposable) => disposable?.dispose());
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
    }

    register(terminal: Terminal): IDisposable {
        this.spawnPty(this._terminalId).then(_ => {
            this._disposables.push(terminal.onData(data => this._pty?.write(data)));
            this._disposables.push(this._pty?.onData(data => terminal?.write(data)));
            //TODO: Is this correct, is a terminal focused if it is initialized
            terminal.focus();
            this._bus.publish({path: ['app', 'terminal', this._terminalId], type: "TerminalInitialized", payload: this._terminalId});
        });
        return this;
    }

    private spawnPty(terminalId: TerminalId) {
        const shellConfig = this._configService.config.shell![1]!;
        return this._pty.spawn(terminalId, shellConfig);
    }

}
