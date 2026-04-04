import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {TerminalId} from "../../../grid-list/+model/model";
import {IPty} from "../pty/pty";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {ShellProfile} from "../../../config/+models/shell-config";

export class PtyHandler implements ITerminalHandler {

    private _resizeObserver: ResizeObserver | undefined = undefined;
    private _resizeRaf?: number;
    private _firstWriteEvent: boolean = false;
    private readonly _disposables: IDisposable[] = [];
    private buffer: string[] = [];

    constructor(
        private _terminalId: TerminalId,
        private _pty: IPty,
        private _shellProfile: ShellProfile,
        private _bus: AppBus
    ) {}

    dispose(): void {
        this._disposables.forEach((disposable) => disposable?.dispose());
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this.spawnPty(this._terminalId, terminal).then(_ => {
            this._disposables.push(terminal.onData(data => this._pty?.write(data)));
            this._disposables.push(this._pty?.onData(data => {
                const isFirst = !this._firstWriteEvent;
                if (isFirst) {
                    this._firstWriteEvent = true;
                    const disposable  = terminal.onWriteParsed(() => {
                        this._bus.publish({path: ['app', 'terminal', this._terminalId], type: "PtyInitialized", payload: {terminalId: this._terminalId, shellType: this._shellProfile.shell_type!}});
                        disposable.dispose();
                    });
                    this.buffer.push(data);
                } else {
                    if(this.buffer.length > 0) {
                        data = data + this.buffer.join('');
                        this.buffer = [];
                    }
                    terminal.write(data);
                }
            }));
            this._disposables.push(this._pty?.onExit(data => {
                this._bus.publish({path: ['app', 'terminal'], type: 'RemovePane', payload: this._terminalId});
            }));
        });
        return this;
    }

    private spawnPty(terminalId: TerminalId, terminal: Terminal) {
        return this._pty.spawn(terminalId, this._shellProfile, {cols: terminal.cols, rows: terminal.rows});
    }

}


