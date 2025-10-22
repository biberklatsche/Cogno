import {Terminal} from "@xterm/xterm";
import {Theme} from "../../config/+models/config";
import {OS} from "../../_tauri/os";
import {FitAddon} from "@xterm/addon-fit";
import {SearchAddon} from "@xterm/addon-search";
import {Unicode11Addon} from "@xterm/addon-unicode11";
import {LigaturesAddon} from "@xterm/addon-ligatures";
import {WebglAddon} from "@xterm/addon-webgl";
import {CanvasAddon} from "@xterm/addon-canvas";
import {IDisposable} from "../../common/models/models";

export interface IRenderer {
    open(terminalContainer: HTMLDivElement): void;

    setTheme(t: Theme, scrollbackLines: number): void;

    useWebGl(): void;

    useCanvas(): void;

    resize(): void;

    focus(): void;

    blur(): void;

    dispose(): void;

    write(data: string): void;

    onData(listener: (data: string) => void | undefined): IDisposable
}

export class Renderer implements IRenderer, IDisposable {

    private terminal: Terminal;
    private resizeObserver: ResizeObserver | undefined = undefined;
    private resizeRaf?: number;
    private fitAddon = new FitAddon();
    private searchAddon = new SearchAddon();
    private unicodeAddon = new Unicode11Addon();
    private ligaturesAddon: LigaturesAddon | undefined = undefined;
    private webglAddon: WebglAddon | undefined = undefined;
    private canvasAddon: CanvasAddon | undefined = undefined;
    private theme: Theme | undefined = undefined;

    constructor() {
        this.terminal = new Terminal({
            overviewRulerWidth: 20,
            cursorStyle: 'bar',
            smoothScrollDuration: 0,
            allowTransparency: true,
            altClickMovesCursor: true,
            windowsPty: OS.platform() === 'windows' ? {backend: 'conpty'} : undefined,
            allowProposedApi: true,
            windowOptions: {
                pushTitle: true, //handle CSI Ps=22 vim on gitbash uses this to enter full screen
                popTitle: true //handle CSI Ps=23 vim on gitbash uses this to leaf full screen
            }
        });

        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(this.searchAddon);
        this.terminal.loadAddon(this.unicodeAddon);

        this.terminal.unicode.activeVersion = '11';
    }

    onData(listener: (data: string) => void | undefined): IDisposable {
        return this.terminal.onData(listener);
    }

    write(data: string): void {
        this.terminal.write(data);
    }

    focus(): void {
        this.terminal.focus();
    }

    blur(): void {
        this.terminal.blur();
    }

    public open(terminalContainer: HTMLDivElement) {
        this.terminal.open(terminalContainer);
        this.resizeObserver = new ResizeObserver(() => {
            // leichtes Throttling gegen Resize-Spam
            if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = requestAnimationFrame(() => this.resize());
        });
        this.resizeObserver.observe(terminalContainer, {box: 'content-box'});
        this.resize();
    }

    public setTheme(t: Theme, scrollbackLines: number) {
        this.theme = t;
        this.terminal.options.scrollback = scrollbackLines;
        this.terminal.options.fontSize = this.theme.terminal_font.size;
        this.terminal.options.fontFamily = `'${this.theme.terminal_font.family}', monospace`;
        this.terminal.options.fontWeight = this.theme.terminal_font.weight;
        this.terminal.options.fontWeightBold = this.theme.terminal_font.weight_bold;
        this.terminal.options.cursorWidth = this.theme.cursor.width;
        this.terminal.options.cursorBlink = this.theme.cursor.blink;
        this.terminal.options.cursorStyle = this.theme.cursor.style;
        this.terminal.options.theme = {
            background: '#00000000',
            cursor: this.theme.color.cursor ? `${this.theme.color.cursor}CC` : `${this.theme.color.highlight}CC`,
            cursorAccent: `${this.theme.color.highlight}66`,
            foreground: this.theme.color.foreground,
            selectionBackground: `${this.theme.color.highlight}88`,
            selectionInactiveBackground: `${this.theme.color.highlight}55`,
            black: this.theme.color.black,
            red: this.theme.color.red,
            green: this.theme.color.green,
            yellow: this.theme.color.yellow,
            blue: this.theme.color.blue,
            magenta: this.theme.color.magenta,
            cyan: this.theme.color.cyan,
            white: this.theme.color.bright_white,
            brightBlack: this.theme.color.bright_black,
            brightRed: this.theme.color.bright_red,
            brightGreen: this.theme.color.bright_green,
            brightYellow: this.theme.color.bright_yellow,
            brightBlue: this.theme.color.bright_blue,
            brightMagenta: this.theme.color.bright_magenta,
            brightCyan: this.theme.color.bright_cyan,
            brightWhite: this.theme.color.bright_white,
        };
        setTimeout(() => this.resize(), 200);
    }

    public useWebGl() {
        if (!this.webglAddon) {
            this.webglAddon = new WebglAddon();
        }
        this.terminal.loadAddon(this.webglAddon);
    }

    public useCanvas() {
        if (!this.canvasAddon) {
            this.canvasAddon = new CanvasAddon();
        }
        this.terminal!.loadAddon(this.canvasAddon);
    }

    public resize() {
        this.fitAddon.fit();
    }

    public dispose() {
        if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.terminal?.dispose();
    }
}