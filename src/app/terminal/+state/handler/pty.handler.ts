import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {TerminalId} from "../../../grid-list/+model/model";
import {ConfigService} from "../../../config/+state/config.service";
import {IPty} from "../pty/pty";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";

export class PtyHandler implements ITerminalHandler {

    private _resizeObserver: ResizeObserver | undefined = undefined;
    private _resizeRaf?: number;
    private _firstWriteEvent: boolean = false;
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
        this.spawnPty(this._terminalId, terminal).then(_ => {
            this._disposables.push(terminal.onData(data => this._pty?.write(data)));
            this._disposables.push(this._pty?.onData(data => {
                const isFirst = !this._firstWriteEvent;
                if (isFirst) {
                    this._firstWriteEvent = true;
                }
                if(isFirst) {
                    this._bus.publish({path: ['app', 'terminal', this._terminalId], type: "TerminalInitialized", payload: this._terminalId});
                }
                terminal.write(data);
            }));
        });
        return this;
    }

    private spawnPty(terminalId: TerminalId, terminal: Terminal) {
        const shellConfig = this._configService.config.shell![1]!;
        return this._pty.spawn(terminalId, shellConfig, {cols: terminal.cols, rows: terminal.rows});
    }

}
