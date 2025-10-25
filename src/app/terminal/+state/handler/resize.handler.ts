import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {IPty} from "../pty/pty";
import {IDisposable} from "../../../common/models/models";
import {FitAddon} from "@xterm/addon-fit";

export class ResizeHandler implements ITerminalHandler {

    private _resizeObserver: ResizeObserver | undefined = undefined;
    private _resizeRaf?: number;

    constructor(
        private _pty: IPty,
        private _terminalContainer: HTMLDivElement
    ) {}

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
