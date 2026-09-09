import { Injectable } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { AppMessage } from "@cogno/core/workbench/bus/messages";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalId } from "@cogno/shared/domain";

/** The bus command each terminal action publishes onto the focused terminal. */
const PANE_COMMANDS = [
  ["split_right", "SplitPaneRight"],
  ["split_left", "SplitPaneLeft"],
  ["split_down", "SplitPaneDown"],
  ["split_up", "SplitPaneUp"],
  ["select_next_pane", "SelectNextPane"],
  ["select_previous_pane", "SelectPreviousPane"],
  ["paste", "Paste"],
  ["clear_buffer", "ClearBuffer"],
  ["close_terminal", "RemovePane"],
  ["maximize_pane", "MaximizePane"],
  // Minimize is the same toggle command as maximize (the pane restores itself).
  ["minimize_pane", "MaximizePane"],
  ["clear_line", "ClearLine"],
  ["clear_line_to_end", "ClearLineToEnd"],
  ["clear_line_to_start", "ClearLineToStart"],
  ["delete_previous_word", "DeletePreviousWord"],
  ["delete_next_word", "DeleteNextWord"],
  ["go_to_next_word", "GoToNextWord"],
  ["go_to_previous_word", "GoToPreviousWord"],
  ["go_to_start_of_line", "GoToStartOfLine"],
  ["go_to_end_of_line", "GoToEndOfLine"],
  ["select_text_right", "SelectTextRight"],
  ["select_text_left", "SelectTextLeft"],
  ["select_word_right", "SelectWordRight"],
  ["select_word_left", "SelectWordLeft"],
  ["select_text_to_end_of_line", "SelectTextToEndOfLine"],
  ["select_text_to_start_of_line", "SelectTextToStartOfLine"],
  ["select_all", "SelectAll"],
] as const satisfies ReadonlyArray<readonly [CoreActionName, string]>;

/** A terminal pane bus command type. */
type PaneCommand = (typeof PANE_COMMANDS)[number][1] | "Copy" | "Cut";

/**
 * Every terminal keybinding action, handled centrally against the focused
 * terminal (ARCHITECTURE.md 5) - the successor of the per-session KeybindExecutor.
 * Each publishes its pane command onto the focused terminal; with no focused
 * terminal it reports unperformed so the keybinding falls through. `copy`/`cut`
 * only fire (and only consume) when a `performable` trigger has a selection.
 */
@Injectable({ providedIn: "root" })
export class TerminalActionHandlers {
  constructor(
    actions: ActionHandlers,
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
  ) {
    for (const [actionName, command] of PANE_COMMANDS) {
      actions.handle(actionName, () => this.publishToFocused(command));
    }
    actions.handle("copy", (context) =>
      this.publishClipboard("Copy", context.trigger?.performable),
    );
    actions.handle("cut", (context) => this.publishClipboard("Cut", context.trigger?.performable));
  }

  private publishToFocused(command: PaneCommand): boolean {
    const terminalId = this.gridListService.getFocusedTerminalId();
    if (!terminalId) {
      return false;
    }
    this.publish(command, terminalId);
    return true;
  }

  private publishClipboard(command: PaneCommand, performable: boolean | undefined): boolean {
    const terminalId = this.gridListService.getFocusedTerminalId();
    if (!terminalId) {
      return false;
    }
    // A performable clipboard keybinding only consumes the key when there is a
    // selection; otherwise it falls through to the terminal.
    if (performable && !this.terminalSessionRegistry.get(terminalId)?.host.hasSelection) {
      return false;
    }
    this.publish(command, terminalId);
    return true;
  }

  private publish(command: PaneCommand, terminalId: TerminalId): void {
    // Every pane command is ActionBase<command, TerminalId> on the terminal
    // path; the union discriminant needs the cast the inline literals avoided.
    this.appBus.publish({
      type: command,
      payload: terminalId,
      path: ["app", "terminal"],
    } as unknown as AppMessage);
  }
}
