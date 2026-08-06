import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalState, TerminalStateManager } from "../../state";
import { resolveBoundsRect, resolveRightUiInset } from "../ui/dropdown-panel-positioning";
import { TerminalDropdownCoordinatorService } from "../ui/terminal-dropdown-coordinator.service";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 920;
const PANEL_MARGIN = 4;
const ESTIMATED_PANEL_HEIGHT = 120;

export type ComposerViewState = {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  placement: "below" | "above";
  seedText: string;
  seedCursorIndex: number;
};

const INITIAL_VIEW_STATE: ComposerViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: PANEL_MIN_WIDTH,
  placement: "below",
  seedText: "",
  seedCursorIndex: 0,
};

/**
 * The multiline composer: a small editor opened instead of fiddling with
 * multiline input at the shell prompt (Shift+Enter, multiline paste). The
 * shell's own input line stays untouched while it is open; submitting hands
 * the final text to the shell in one atomic ReplaceTerminalInput — so all the
 * editing happens in the DOM where it is trivially editor-like, and the shell
 * only ever sees finished input.
 */
@Injectable()
export class TerminalComposerService implements OnDestroy {
  private readonly _viewState = new BehaviorSubject<ComposerViewState>(INITIAL_VIEW_STATE);
  private readonly _subscription = new Subscription();
  private _hostElement?: HTMLElement;

  get viewState$() {
    return this._viewState.asObservable();
  }

  constructor(
    private readonly stateManager: TerminalStateManager,
    private readonly bus: AppBus,
    private readonly dropdownCoordinator: TerminalDropdownCoordinatorService,
  ) {
    this._subscription.add(
      this.bus.on$({ path: ["app", "terminal"], type: "OpenComposer" }).subscribe((event) => {
        const payload = event.payload;
        if (!payload || payload.terminalId !== this.stateManager.terminalId) return;
        if (this.stateManager.isCommandRunning) return;
        this.open(payload.seedText, payload.cursorIndex);
      }),
    );
  }

  ngOnDestroy(): void {
    this.dropdownCoordinator.release(this);
    this._subscription.unsubscribe();
  }

  setHostElement(element: HTMLElement): void {
    this._hostElement = element;
  }

  open(seedText: string, cursorIndex: number): void {
    const position = this.computePanelPosition(this.stateManager.state);
    // Claiming closes autocomplete/history; the composer replaces them while
    // open (its textarea owns the keyboard anyway).
    this.dropdownCoordinator.claim(this);
    this._viewState.next({
      visible: true,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      seedText: seedText.replace(/\r\n/g, "\n"),
      seedCursorIndex: Math.max(0, Math.min(cursorIndex, seedText.length)),
    });
  }

  hide(): void {
    this.dropdownCoordinator.release(this);
    if (!this._viewState.value.visible) return;
    this._viewState.next(INITIAL_VIEW_STATE);
  }

  /**
   * Hands the composed text to the shell: one atomic replace of the current
   * input line, executed immediately unless `insertOnly` asks for the text to
   * be left in the prompt for further shell-side interaction.
   */
  submit(text: string, options?: { insertOnly?: boolean }): void {
    // Trailing blank lines are composer editing artifacts (e.g. the newline
    // left over from Shift+Enter), not intentional input — drop them before
    // handing the text to the shell.
    const trimmedText = text.trimEnd();
    this.bus.publish({
      path: ["app", "terminal"],
      type: "ReplaceTerminalInput",
      payload: {
        terminalId: this.stateManager.terminalId,
        inputText: trimmedText,
        cursorIndex: trimmedText.length,
        autoExecute: !options?.insertOnly,
      },
    });
    this.hide();
  }

  /**
   * Global capture listener entry (see TerminalDropdownCoordinatorService).
   * The composer's textarea handles its own keys — only events from outside
   * the panel are interesting, and only Escape: it cancels no matter where
   * focus ended up.
   */
  dispatchKeydown(event: KeyboardEvent): void {
    if (!this._viewState.value.visible) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".composer-panel")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.hide();
    }
  }

  private computePanelPosition(state: TerminalState): {
    x: number;
    y: number;
    width: number;
    placement: "below" | "above";
  } {
    const cellHeight = Math.max(1, state.dimensions.cellHeight || 18);
    const windowWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const windowHeight = Math.max(
      1,
      window.innerHeight || document.documentElement.clientHeight || cellHeight,
    );
    const bounds = resolveBoundsRect(windowWidth, windowHeight);
    const rightUiInset = resolveRightUiInset(windowWidth);
    const hostRect = this._hostElement?.getBoundingClientRect();

    // Anchor at the start of the input line (not the cursor column): the
    // composer visually replaces the prompt input, so it spans the terminal
    // width up to the panel maximum.
    const x = Math.max(bounds.left + PANEL_MARGIN, (hostRect?.left ?? 0) + PANEL_MARGIN);
    const effectiveRight = Math.max(
      x + PANEL_MIN_WIDTH,
      bounds.right - rightUiInset - PANEL_MARGIN,
    );
    const width = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, effectiveRight - x));

    const row = Math.max(1, state.cursorPosition.viewport.row);
    const cursorLineTop = (hostRect?.top ?? 0) + (row - 1) * cellHeight;
    const belowY = cursorLineTop + cellHeight + PANEL_MARGIN;
    const fitsBelow = belowY + ESTIMATED_PANEL_HEIGHT <= bounds.bottom - PANEL_MARGIN;
    const placement: "below" | "above" = fitsBelow ? "below" : "above";
    const y = fitsBelow
      ? belowY
      : Math.max(bounds.top + PANEL_MARGIN + ESTIMATED_PANEL_HEIGHT, cursorLineTop - PANEL_MARGIN);

    return { x, y, width, placement };
  }
}
