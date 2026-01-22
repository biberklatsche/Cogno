import {Terminal} from "@xterm/xterm";
import {OS} from "../../../_tauri/os";
import {FitAddon} from "@xterm/addon-fit";
import {SearchAddon} from "@xterm/addon-search";
import {Unicode11Addon} from "@xterm/addon-unicode11";
import {LigaturesAddon} from "@xterm/addon-ligatures";
import {WebglAddon} from "@xterm/addon-webgl";
import {IDisposable} from "../../../common/models/models";
import {IFitHandler, isFitHandler, isTerminalHandler, ITerminalHandler} from "../handler/handler";
import {Config} from "../../../config/+models/config";

export interface IRenderer {
    open(terminalContainer: HTMLDivElement, enableLigatures: boolean): void;

    dispose(): void;

    register(handler: ITerminalHandler): IDisposable;
}

export class Renderer implements IRenderer, IDisposable {

    private _terminal: Terminal;

    private _fitAddon = new FitAddon();
    private _searchAddon = new SearchAddon();
    private _unicodeAddon = new Unicode11Addon();
    private _ligaturesAddon: LigaturesAddon | undefined = undefined;
    private _webglAddon: WebglAddon | undefined = undefined;

    constructor(config: Config) {
        this._terminal = new Terminal({
            overviewRuler: {width: config.overview_ruler_width, showBottomBorder: false, showTopBorder: false},
            scrollback: config.scrollback_lines,
            tabStopWidth: config.tab_stop_width,
            scrollSensitivity: config.scroll_sensitivity,
            scrollOnUserInput: config.scroll_on_user_input,
            smoothScrollDuration: config.smooth_scroll_duration,
            allowTransparency: config.allow_transparency,
            altClickMovesCursor: config.alt_click_moves_cursor,
            convertEol: config.convert_eol,
            customGlyphs: config.font!.custom_glyphs,
            drawBoldTextInBrightColors: config.font!.draw_bold_text_in_bright_colors,
            fastScrollSensitivity: config.fast_scroll_sensitivity,
            ignoreBracketedPasteMode: config.ignore_bracketed_paste_mode,
            minimumContrastRatio: config.minimum_contrast_ratio,
            rescaleOverlappingGlyphs: config.font!.rescale_overlapping_glyphs,
            rightClickSelectsWord: config.right_click_selects_word,
            screenReaderMode: config.screen_reader_mode,
            wordSeparator: config.word_separator,
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
        if(config.enable_webgl) {
            this.useWebGl();
        }
    }

    register(handler: ITerminalHandler | IFitHandler): IDisposable {
        if(isFitHandler(handler)) {
            handler.registerFitAddon(this._fitAddon)
        }
        if(isTerminalHandler(handler)) {
            return handler.registerTerminal(this._terminal);
        }
        throw new Error('unknown handler type');
    }

    public open(terminalContainer: HTMLDivElement, enableLigatures: boolean) {
        this._terminal.open(terminalContainer);
        if(enableLigatures) {
            this.useLigatures();
        }
    }

    private useLigatures() {
        if (!this._ligaturesAddon) {
            this._ligaturesAddon = new LigaturesAddon();
        }
        this._terminal.loadAddon(this._ligaturesAddon);
    }

    private useWebGl() {
        if (!this._webglAddon) {
            this._webglAddon = new WebglAddon();
        }
        this._terminal.loadAddon(this._webglAddon);
    }

    public dispose() {

        this._terminal?.dispose();
    }
}
