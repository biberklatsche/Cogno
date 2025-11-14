import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IPty} from "../pty/pty";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";
import {AppBus} from "../../../app-bus/app-bus";
import {Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";

export type TerminalDimensions = {rows: number; cols: number};

export class ResizeHandler implements ITerminalHandler {

    private _subscription?: Subscription;
    private _resizeObserver?: ResizeObserver;
    private _resizeRaf?: number;
    private _ptyResizeTimeout: number | null = null;

    constructor(
        private _terminalId: TerminalId,
        private _pty: IPty,
        private _bus: AppBus,
        private _terminalContainer: HTMLDivElement
    ) {
    }

    dispose(): void {
        if (this._resizeRaf){
            cancelAnimationFrame(this._resizeRaf);
            this._resizeRaf = undefined;
        }

        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;

        this._subscription?.unsubscribe();
        this._subscription = undefined;
    }

    register(terminal: Terminal, fitAddon: FitAddon): IDisposable {
        this._resizeObserver = new ResizeObserver(() => {
            // leichtes Throttling gegen Resize-Spam
            if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
            this._resizeRaf = requestAnimationFrame(() => {
                this.resize(terminal, fitAddon);
            });
        });
        this._resizeObserver.observe(this._terminalContainer, {box: 'content-box'});
        this._subscription = new Subscription();
        this._subscription = this._bus.on$({path: ['app', 'terminal', this._terminalId]})
            .subscribe((e) => {
            switch (e.type) {
                //case 'TerminalInitialized':
                case 'TerminalThemeChanged':
                case 'TerminalThemePaddingRemoved':
                    setTimeout(() => this.resize(terminal, fitAddon), 100);
                    break;
                case 'TerminalThemePaddingAdded':
                    setTimeout(() => this.resize(terminal, fitAddon), 100);
                    break;
            }
        });
        return this;
    }

    public resize(terminal: Terminal, fitAddon: FitAddon) {
        const currentDimensions: TerminalDimensions = {cols: terminal.cols, rows: terminal.rows};
        const newRendererDimensions = fitAddon.proposeDimensions();
        if(!newRendererDimensions) return;
        if(!this.areDimensionsEqual(newRendererDimensions, currentDimensions)) {
            fitAddon.fit();
            const terminalDimensions: TerminalDimensions = {cols: terminal.cols, rows: terminal.rows};

            if(!this.areDimensionsEqual(newRendererDimensions, terminalDimensions)){
                throw new Error('dimensions are not equal!');
            }

            this._bus.publish({
                path: ["inspector"],
                type: "Inspector",
                payload: { type: "terminal-dimensions", data: { terminalId: this._terminalId, cols: newRendererDimensions.cols, rows: newRendererDimensions.rows } }
            });

            if (this._ptyResizeTimeout !== null) {
                clearTimeout(this._ptyResizeTimeout);
            }

            this._ptyResizeTimeout = window.setTimeout(() => {
                this._pty.resize(newRendererDimensions);
                this._ptyResizeTimeout = null;
            }, 100);
        }
    }

    private areDimensionsEqual(a?: TerminalDimensions, b?: TerminalDimensions) {
        return a?.rows === b?.rows && a?.cols === b?.cols;
    }
}
