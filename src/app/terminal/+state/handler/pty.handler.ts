import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {TerminalId} from "../../../grid-list/+model/model";
import {ConfigService} from "../../../config/+state/config.service";
import {Pty} from "../../../_tauri/pty";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";

export class PtyHandler implements ITerminalHandler {

    private _pty = new Pty();
    private _resizeObserver: ResizeObserver | undefined = undefined;
    private _resizeRaf?: number;
    private readonly _disposables: IDisposable[] = [];

    constructor(
        private _terminalId: TerminalId,
        private _configService: ConfigService,
        private _bus: AppBus,
        private _terminalContainer: HTMLDivElement
    ) {}

    dispose(): void {
        this._pty.kill();
        this._disposables.forEach((disposable) => disposable?.dispose());
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
    }

    register(terminal: Terminal, fitAddon: FitAddon): IDisposable {
        this.spawnPty(this._terminalId).then(_ => {
            this._disposables.push(terminal.onData(data => this._pty?.write(data)));
            this._disposables.push(this._pty?.onData(data => terminal?.write(data)));
            this._bus.publish({type: "TerminalInitializedEvent", payload: this._terminalId});
        });
        this._resizeObserver = new ResizeObserver(() => {
            // leichtes Throttling gegen Resize-Spam
            if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
            this._resizeRaf = requestAnimationFrame(() => {
                fitAddon?.fit();
                this._pty.resize(terminal.cols, terminal.rows);
            });
        });
        this._resizeObserver.observe(this._terminalContainer, {box: 'content-box'});
        fitAddon?.fit();
        this._pty.resize(terminal.cols, terminal.rows);
        return this;
    }

    private spawnPty(terminalId: TerminalId) {
        const shellConfig = this._configService.config.shell[1]!;
        return this._pty.spawn(terminalId, shellConfig);
    }

}
