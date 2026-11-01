import { IDisposable } from "@cogno/shared/support";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { IPty } from "../pty";
import { IFitHandler, ITerminalHandler } from "../terminal-handler";
import { isValidTerminalDimensions, TerminalDimensions } from "../terminal-machine.events";
import type { TerminalMachineState } from "../terminal-machine.state";

/**
 * The least time between two sizes the pty is told. xterm refits on every
 * frame of a drag so the text reflows with the pane; the pty (ConPTY above
 * all, which repaints its whole screen for each size it gets) hears the
 * first size at once and then one per period, the last of a drag included.
 */
export const PTY_RESIZE_SETTLE_MS = 80;

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
  private _resizeObserver?: ResizeObserver;
  private _terminal?: Terminal;
  private _fitAddon?: FitAddon;
  private _resizeRaf?: number;
  private _ptyResizeTimer?: ReturnType<typeof setTimeout>;
  private _pendingPtyDimensions?: TerminalDimensions;
  private _sentPtyDimensions?: TerminalDimensions;

  constructor(
    private _pty: IPty,
    private _terminalContainer: HTMLDivElement,
    private _stateManager: TerminalMachineState,
  ) {}

  registerFitAddon(fitAddon: FitAddon) {
    this._fitAddon = fitAddon;
  }

  dispose(): void {
    if (this._resizeRaf) {
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = undefined;
    }
    if (this._ptyResizeTimer !== undefined) {
      clearTimeout(this._ptyResizeTimer);
      this._ptyResizeTimer = undefined;
    }
    this._pendingPtyDimensions = undefined;

    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;

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
      isValidTerminalDimensions(newRendererDimensions) &&
      !this.areDimensionsEqual(newRendererDimensions, currentDimensions)
    ) {
      this._fitAddon.fit();
      this.resizePty(newRendererDimensions);
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

  /**
   * Fit the terminal to its container without touching the pty. A restored
   * session sizes its terminal before the shell is spawned (so the replayed
   * scrollback and the ConPTY viewport fill use the real row count); `resize()`
   * itself calls `pty.resize()`, which throws before the spawn. The
   * pty then spawns at this fitted size, so no separate pty resize is needed.
   */
  fitTerminalWithoutPty(): void {
    if (!this._terminal || !this._fitAddon) return;
    const dimensions = this._fitAddon.proposeDimensions();
    if (dimensions && isValidTerminalDimensions(dimensions)) {
      this._fitAddon.fit();
    }
  }

  /**
   * Tell the pty the size: now when it has been quiet, otherwise once the
   * period is over - only the newest size, a drag's intermediate ones are
   * never sent.
   */
  private resizePty(dimensions: TerminalDimensions): void {
    if (this._ptyResizeTimer !== undefined) {
      this._pendingPtyDimensions = dimensions;
      return;
    }
    if (this.areDimensionsEqual(dimensions, this._sentPtyDimensions)) return;
    this._sentPtyDimensions = dimensions;
    this._pty.resize(dimensions);
    this._ptyResizeTimer = setTimeout(() => {
      this._ptyResizeTimer = undefined;
      const pending = this._pendingPtyDimensions;
      this._pendingPtyDimensions = undefined;
      if (pending) this.resizePty(pending);
    }, PTY_RESIZE_SETTLE_MS);
  }

  private areDimensionsEqual(a?: TerminalDimensions, b?: TerminalDimensions) {
    return a?.rows === b?.rows && a?.cols === b?.cols;
  }
}
