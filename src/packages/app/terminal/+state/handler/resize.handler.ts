import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { IDisposable } from "../../../common/models/models";
import { TerminalId } from "../../../grid-list/+model/model";
import { IPty } from "../pty/pty";
import { TerminalStateManager } from "../state";
import { IFitHandler, ITerminalHandler } from "./handler";

export type TerminalDimensions = { rows: number; cols: number };
type NullableTerminalDimensions = {
  rows: number | null | undefined;
  cols: number | null | undefined;
};

type TerminalCoreWithCharSize = {
  _core?: {
    _renderService?: {
      _charSizeService?: {
        height?: number;
        width?: number;
      };
    };
  };
};

export class ResizeHandler implements ITerminalHandler, IFitHandler {
  private _subscription?: Subscription;
  private _resizeObserver?: ResizeObserver;
  private _terminal?: Terminal;
  private _fitAddon?: FitAddon;
  private _resizeRaf?: number;

  constructor(
    private _terminalId: TerminalId,
    private _pty: IPty,
    private _bus: AppBus,
    private _terminalContainer: HTMLDivElement,
    private _stateManager: TerminalStateManager,
  ) {}

  registerFitAddon(fitAddon: FitAddon) {
    this._fitAddon = fitAddon;
  }

  dispose(): void {
    if (this._resizeRaf) {
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
    this._resizeObserver.observe(this._terminalContainer, { box: "content-box" });
    this._subscription = new Subscription();
    this._subscription = this._bus
      .on$({ path: ["app", "terminal", this._terminalId] })
      .subscribe((e) => {
        switch (e.type) {
          case "TerminalThemeChanged":
          case "TerminalThemePaddingRemoved":
            setTimeout(() => this.resize(), 100);
            break;
          case "TerminalThemePaddingAdded":
            setTimeout(() => this.resize(), 100);
            break;
        }
      });
    return this;
  }

  public resize() {
    if (this._terminal === undefined || this._fitAddon === undefined) return;
    const currentDimensions: TerminalDimensions = {
      cols: this._terminal.cols,
      rows: this._terminal.rows,
    };
    const newRendererDimensions = this._fitAddon.proposeDimensions();
    if (!newRendererDimensions) return;
    const terminalCore = this._terminal as Terminal & TerminalCoreWithCharSize;
    const coreBeforeFit = terminalCore._core;
    const cellHeightBeforeFit = coreBeforeFit?._renderService?._charSizeService?.height;
    const cellWidthBeforeFit = coreBeforeFit?._renderService?._charSizeService?.width;
    const viewportWidth = this._terminalContainer.clientWidth;
    const viewportHeight = this._terminalContainer.clientHeight;

    if (
      this.isValidDimensions(newRendererDimensions) &&
      !this.areDimensionsEqual(newRendererDimensions, currentDimensions)
    ) {
      this._pty.resize(newRendererDimensions);
      this._fitAddon.fit();
    }
    const core = terminalCore._core;
    const cellHeight = core?._renderService?._charSizeService?.height ?? cellHeightBeforeFit ?? 0;
    const cellWidth = core?._renderService?._charSizeService?.width ?? cellWidthBeforeFit ?? 0;
    this._stateManager.updateDimensions({
      cols: this._terminal.cols,
      rows: this._terminal.rows,
      cellHeight,
      cellWidth,
      viewportWidth,
      viewportHeight,
    });
  }

  private areDimensionsEqual(a?: TerminalDimensions, b?: TerminalDimensions) {
    return a?.rows === b?.rows && a?.cols === b?.cols;
  }

  private isValidDimensions(
    dimensions: NullableTerminalDimensions,
  ): dimensions is TerminalDimensions {
    const { cols, rows } = dimensions;
    return (
      Number.isInteger(cols) &&
      Number.isInteger(rows) &&
      cols !== null &&
      cols !== undefined &&
      rows !== null &&
      rows !== undefined &&
      cols > 0 &&
      rows > 0
    );
  }
}
