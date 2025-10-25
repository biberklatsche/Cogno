import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IPty} from "../pty/pty";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";
import {AppBus} from "../../../app-bus/app-bus";
import {debounceTime, Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";

export class ResizeHandler implements ITerminalHandler {

    private _subscription?: Subscription;
    private _resizeObserver?: ResizeObserver;
    private _fitAddon?: FitAddon;
    private _terminal?: Terminal;
    private _resizeRaf?: number;

    constructor(
        _terminalId: TerminalId,
        private _pty: IPty,
        private _bus: AppBus,
        private _terminalContainer: HTMLDivElement
    ) {
        this._subscription?.add(this._bus.on$({path: ['app', 'terminal', _terminalId], type: 'TerminalThemeChanged'}).pipe(debounceTime(200)).subscribe(() => {
            this._fitAddon?.fit();
            this._pty.resize(this._terminal?.cols || 80, this._terminal?.rows || 25);
        }));
    }

    dispose(): void {
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
    }

    register(terminal: Terminal, fitAddon: FitAddon): IDisposable {
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
}
