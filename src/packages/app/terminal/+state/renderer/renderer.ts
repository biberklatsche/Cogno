import { OS } from "@cogno/app-tauri/os";
import { FitAddon } from "@xterm/addon-fit";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { BehaviorSubject, Observable } from "rxjs";
import { IDisposable } from "../../../common/models/models";
import { Config } from "../../../config/+models/config";
import {
  IFitHandler,
  ISearchHandler,
  ITerminalHandler,
  isFitHandler,
  isSearchHandler,
  isTerminalHandler,
} from "../handler/handler";

export interface IRenderer {
  open(terminalContainer: HTMLDivElement, enableLigatures: boolean): void;
  readonly terminal: Terminal;
  readonly isWebglContextLost$: Observable<boolean>;

  dispose(): void;

  register(handler: ITerminalHandler | IFitHandler | ISearchHandler): IDisposable;
}

export class Renderer implements IRenderer, IDisposable {
  private static readonly WEBGL_RESTORE_DELAYS_MS = [0, 250, 1000, 3000] as const;

  private _terminal: Terminal;
  private readonly _webglEnabled: boolean;
  private _disposed = false;

  private _fitAddon = new FitAddon();
  private _searchAddon = new SearchAddon();
  private _unicodeAddon = new Unicode11Addon();
  private _ligaturesAddon: LigaturesAddon | undefined = undefined;
  private _webglAddon: WebglAddon | undefined = undefined;
  private _webglContextLossDisposable: IDisposable | undefined = undefined;
  private _webglRestoreTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
  private _webglRestoreAttempt = 0;
  private readonly _isWebglContextLostSubject = new BehaviorSubject<boolean>(false);

  constructor(config: Config) {
    this._webglEnabled = config.terminal?.webgl ?? false;
    this._terminal = new Terminal({
      overviewRuler: {
        width: config.scrollbar?.width,
        showBottomBorder: false,
        showTopBorder: false,
      },
      scrollback: config.scrollbar?.scrollback_lines,
      tabStopWidth: config.terminal?.tab_stop_width,
      scrollSensitivity: config.scrollbar?.sensitivity,
      fastScrollSensitivity: config.scrollbar?.fast_scroll_sensitivity,
      scrollOnUserInput: config.scrollbar?.scroll_on_user_input,
      smoothScrollDuration: config.scrollbar?.smooth_scroll_duration,
      allowTransparency: config.terminal?.allow_transparency,
      altClickMovesCursor: config.cursor?.alt_click_moves_cursor,
      customGlyphs: config.font?.custom_glyphs,
      drawBoldTextInBrightColors: config.font?.draw_bold_text_in_bright_colors,
      ignoreBracketedPasteMode: config.terminal?.ignore_bracketed_paste_mode,
      minimumContrastRatio: config.terminal?.minimum_contrast_ratio,
      rescaleOverlappingGlyphs: config.font?.rescale_overlapping_glyphs,
      rightClickSelectsWord: config.selection?.right_click_selects_word,
      screenReaderMode: config.terminal?.screen_reader_mode,
      wordSeparator: config.terminal?.word_separator,
      windowsPty: OS.platform() === "windows" ? { backend: "conpty" } : undefined,
      allowProposedApi: true,
      windowOptions: {
        pushTitle: true, //handle CSI Ps=22 vim on gitbash uses this to enter full screen
        popTitle: true, //handle CSI Ps=23 vim on gitbash uses this to leaf full screen
      },
      // Font settings - must be set during initialization
      fontFamily: config.font?.family,
      fontSize: config.font?.size,
      fontWeight: config.font?.weight,
      fontWeightBold: config.font?.weight_bold,
    });

    this._terminal.loadAddon(this._fitAddon);
    this._terminal.loadAddon(this._searchAddon);
    this._terminal.loadAddon(this._unicodeAddon);
    this._terminal.unicode.activeVersion = "11";
    if (this._webglEnabled) {
      this.useWebGl();
    }
  }

  register(handler: ITerminalHandler | IFitHandler | ISearchHandler): IDisposable {
    if (isFitHandler(handler)) {
      handler.registerFitAddon(this._fitAddon);
    }
    if (isSearchHandler(handler)) {
      handler.registerSearchAddon(this._searchAddon);
    }
    if (isTerminalHandler(handler)) {
      return handler.registerTerminal(this._terminal);
    }
    throw new Error("unknown handler type");
  }

  public open(terminalContainer: HTMLDivElement, enableLigatures: boolean) {
    this._terminal.open(terminalContainer);
    if (enableLigatures) {
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
      this._webglContextLossDisposable = this._webglAddon.onContextLoss(() => {
        this.handleWebGlContextLoss();
      });
    }
    this._terminal.loadAddon(this._webglAddon);
  }

  public dispose() {
    this._disposed = true;
    if (this._webglRestoreTimeout) {
      clearTimeout(this._webglRestoreTimeout);
      this._webglRestoreTimeout = undefined;
    }
    this.disposeWebGlAddon();
    this._terminal?.dispose();
    this._isWebglContextLostSubject.complete();
  }

  public get terminal(): Terminal {
    return this._terminal;
  }

  public get isWebglContextLost$(): Observable<boolean> {
    return this._isWebglContextLostSubject.asObservable();
  }

  private disposeWebGlAddon() {
    this._webglContextLossDisposable?.dispose();
    this._webglContextLossDisposable = undefined;
    this._webglAddon?.dispose();
    this._webglAddon = undefined;
  }

  private handleWebGlContextLoss() {
    this._isWebglContextLostSubject.next(true);
    this.disposeWebGlAddon();
    this.scheduleWebGlRestore();
  }

  private scheduleWebGlRestore() {
    if (!this._webglEnabled || this._disposed || this._webglRestoreTimeout) {
      return;
    }
    const restoreDelay =
      Renderer.WEBGL_RESTORE_DELAYS_MS[this._webglRestoreAttempt] ??
      Renderer.WEBGL_RESTORE_DELAYS_MS[Renderer.WEBGL_RESTORE_DELAYS_MS.length - 1];
    this._webglRestoreAttempt += 1;
    this._webglRestoreTimeout = setTimeout(() => {
      this._webglRestoreTimeout = undefined;
      if (this._disposed) {
        return;
      }
      this.useWebGl();
      this._isWebglContextLostSubject.next(false);
    }, restoreDelay);
  }
}
