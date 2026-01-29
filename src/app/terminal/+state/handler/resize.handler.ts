import {IFitHandler, ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IPty} from "../pty/pty";
import {FitAddon} from "@xterm/addon-fit";
import {AppBus} from "../../../app-bus/app-bus";
import {Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";
import {IDisposable} from "../../../common/models/models";
import {TerminalStateManager} from "../state";

export type TerminalDimensions = { rows: number; cols: number };

export class ResizeHandler implements ITerminalHandler, IFitHandler {

    private _subscription?: Subscription;
    private _resizeObserver?: ResizeObserver;
    private _terminal?: Terminal;
    private _fitAddon?: FitAddon;
    private _resizeRaf?: number;
    private _ptyResizeTimeout: number | null = null;

    constructor(
        private _terminalId: TerminalId,
        private _pty: IPty,
        private _bus: AppBus,
        private _terminalContainer: HTMLDivElement,
        private _stateManager: TerminalStateManager
    ) {
    }

    registerFitAddon(fitAddon: FitAddon) {
        this._fitAddon = fitAddon;
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

        this._fitAddon = undefined;
        this._terminal = undefined;
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this._resizeObserver = new ResizeObserver(() => {
            // leichtes Throttling gegen Resize-Spam
            if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
            this._resizeRaf = requestAnimationFrame(() => {
                this.resize();
            });
        });
        this._resizeObserver.observe(this._terminalContainer, {box: 'content-box'});
        this._subscription = new Subscription();
        this._subscription = this._bus.on$({path: ['app', 'terminal', this._terminalId]})
            .subscribe((e) => {
            switch (e.type) {
                case 'TerminalThemeChanged':
                case 'TerminalThemePaddingRemoved':
                    setTimeout(() => this.resize(), 100);
                    break;
                case 'TerminalThemePaddingAdded':
                    setTimeout(() => this.resize(), 100);
                    break;
            }
        });
        return this;
    }

    public resize() {
        if(this._terminal === undefined || this._fitAddon === undefined) return;
        const currentDimensions: TerminalDimensions = {cols: this._terminal.cols, rows: this._terminal.rows};
        const newRendererDimensions = this._fitAddon.proposeDimensions();
        if(!newRendererDimensions) return;
        if(!this.areDimensionsEqual(newRendererDimensions, currentDimensions)) {
            this._fitAddon.fit();

            const core = (this._terminal as any)._core;
            const cellHeight = core?._renderService?._charSizeService?.height;
            const cellWidth = core?._renderService?._charSizeService?.width;

            this._stateManager.updateDimensions({ cols: newRendererDimensions.cols, rows: newRendererDimensions.rows, cellHeight, cellWidth });

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
