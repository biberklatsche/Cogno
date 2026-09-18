import { Injectable } from "@angular/core";
import { ActionHandler, ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { ShellLineEditorActionContract } from "@cogno/shared/contributions";
import { TerminalId } from "@cogno/shared/domain";

/** The line-editor action each of these terminal actions runs. */
const EDITOR_ACTIONS = [
  ["clear_line", "clearLine"],
  ["clear_line_to_end", "clearLineToEnd"],
  ["clear_line_to_start", "clearLineToStart"],
  ["delete_previous_word", "deletePreviousWord"],
  ["delete_next_word", "deleteNextWord"],
  ["go_to_next_word", "goToNextWord"],
  ["go_to_previous_word", "goToPreviousWord"],
  ["go_to_start_of_line", "goToStartOfLine"],
  ["go_to_end_of_line", "goToEndOfLine"],
  ["select_text_right", "selectTextRight"],
  ["select_text_left", "selectTextLeft"],
  ["select_word_right", "selectWordRight"],
  ["select_word_left", "selectWordLeft"],
  ["select_text_to_end_of_line", "selectTextToEndOfLine"],
  ["select_text_to_start_of_line", "selectTextToStartOfLine"],
  ["select_all", "selectAll"],
] as const satisfies ReadonlyArray<readonly [CoreActionName, ShellLineEditorActionContract]>;

/**
 * Every terminal action, handled centrally (ARCHITECTURE.md 5) - the successor
 * of the per-session KeybindExecutor. An action runs on the terminal it names
 * (the context menu, HTTP) or else on the focused one; with neither it reports
 * unperformed so the keybinding falls through. `copy`/`cut` only fire (and only
 * consume) when a `performable` trigger has a selection.
 */
@Injectable({ providedIn: "root" })
export class TerminalActionHandlers {
  constructor(
    actions: ActionHandlers,
    private readonly gridListService: GridListService,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
  ) {
    const grid = this.gridListService;
    actions.handle(
      "split_right",
      this.onPane((id) => grid.split(id, "vertical", "r")),
    );
    actions.handle(
      "split_left",
      this.onPane((id) => grid.split(id, "vertical", "l")),
    );
    actions.handle(
      "split_down",
      this.onPane((id) => grid.split(id, "horizontal", "r")),
    );
    actions.handle(
      "split_up",
      this.onPane((id) => grid.split(id, "horizontal", "l")),
    );
    actions.handle(
      "select_next_pane",
      this.onPane((id) => grid.focusAdjacentPane(id, 1)),
    );
    actions.handle(
      "select_previous_pane",
      this.onPane((id) => grid.focusAdjacentPane(id, -1)),
    );
    // Minimize is the same toggle as maximize (the pane restores itself).
    actions.handle(
      "maximize_pane",
      this.onPane((id) => grid.togglePaneMaximize(id)),
    );
    actions.handle(
      "minimize_pane",
      this.onPane((id) => grid.togglePaneMaximize(id)),
    );
    // A pane whose shell never started has no live session, yet it must close.
    actions.handle(
      "close_terminal",
      this.onTerminal((id) => grid.removePane(id)),
    );

    actions.handle(
      "paste",
      this.onSession((id) => void this.hostOf(id)?.paste()),
    );
    actions.handle(
      "clear_buffer",
      this.onSession((id) => this.hostOf(id)?.clearBuffer()),
    );
    for (const [actionName, editorAction] of EDITOR_ACTIONS) {
      actions.handle(
        actionName,
        this.onSession((id) => this.hostOf(id)?.runEditorAction(editorAction)),
      );
    }
    actions.handle(
      "copy",
      this.onSelection((id) => void this.hostOf(id)?.copy()),
    );
    actions.handle(
      "cut",
      this.onSelection((id) => this.hostOf(id)?.cut()),
    );
  }

  /** Runs on the terminal the action names, else on the focused one. */
  private onTerminal(
    run: (terminalId: TerminalId) => void,
    accepts: (terminalId: TerminalId) => boolean = () => true,
  ): ActionHandler {
    return (context) => {
      const terminalId = this.targetOf(context);
      if (!terminalId || !accepts(terminalId)) {
        return false;
      }
      run(terminalId);
      return true;
    };
  }

  /** An action on a session: it has to be a live one. */
  private onSession(run: (terminalId: TerminalId) => void): ActionHandler {
    return this.onTerminal(run, (id) => this.terminalSessionRegistry.has(id));
  }

  /** A layout action: its pane has to be in the tab that is showing. */
  private onPane(run: (terminalId: TerminalId) => void): ActionHandler {
    return this.onTerminal(run, (id) => this.gridListService.isPaneInActiveTab(id));
  }

  /**
   * A performable clipboard keybinding only consumes the key when there is a
   * selection; otherwise it falls through to the terminal.
   */
  private onSelection(run: (terminalId: TerminalId) => void): ActionHandler {
    const onSession = this.onSession(run);
    return (context) => {
      if (context.trigger?.performable && !this.hostOf(this.targetOf(context))?.hasSelection) {
        return false;
      }
      return onSession(context);
    };
  }

  private targetOf(context: { terminalId?: TerminalId }): TerminalId | undefined {
    return context.terminalId ?? this.gridListService.getFocusedTerminalId();
  }

  private hostOf(terminalId: TerminalId | undefined) {
    return this.terminalSessionRegistry.get(terminalId)?.host;
  }
}
