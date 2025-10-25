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
import {ITerminalHandler} from "./handler/handler";

export interface IAppTerminal {
    open(terminalContainer: HTMLDivElement): void;

    useWebGl(): void;

    useCanvas(): void;

    dispose(): void;

    register(observer: ITerminalHandler): IDisposable;
}

export class AppTerminal implements IAppTerminal, IDisposable {

    private _terminal: Terminal;

    private _fitAddon = new FitAddon();
    private _searchAddon = new SearchAddon();
    private _unicodeAddon = new Unicode11Addon();
    private _ligaturesAddon: LigaturesAddon | undefined = undefined;
    private _webglAddon: WebglAddon | undefined = undefined;
    private _canvasAddon: CanvasAddon | undefined = undefined;

    constructor() {
        this._terminal = new Terminal({
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

        this._terminal.loadAddon(this._fitAddon);
        this._terminal.loadAddon(this._searchAddon);
        this._terminal.loadAddon(this._unicodeAddon);
        this._terminal.unicode.activeVersion = '11';
    }

    register(handler: ITerminalHandler): IDisposable {
        return handler.register(this._terminal, this._fitAddon);
    }

    public open(terminalContainer: HTMLDivElement) {
        this._terminal.open(terminalContainer);
    }

    public useWebGl() {
        if (!this._webglAddon) {
            this._webglAddon = new WebglAddon();
        }
        this._terminal.loadAddon(this._webglAddon);
    }

    public useCanvas() {
        if (!this._canvasAddon) {
            this._canvasAddon = new CanvasAddon();
        }
        this._terminal!.loadAddon(this._canvasAddon);
    }

    public dispose() {

        this._terminal?.dispose();
    }
}
