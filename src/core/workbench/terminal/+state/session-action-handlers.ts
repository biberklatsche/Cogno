import { Injectable } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";

const SESSION_ACTIONS: ReadonlyArray<CoreActionName> = [
  "trigger_autocomplete",
  "trigger_command_history",
  "cycle_tab",
];

/**
 * The session-scoped keybinding actions (autocomplete, command history, cycle),
 * dispatched centrally to the focused session's keybindings - the successor of
 * the per-session ActionFired subscription. Each session's autocomplete/history
 * still gates on focus itself, so an action with no focused session no-ops.
 */
@Injectable({ providedIn: "root" })
export class SessionActionHandlers {
  constructor(
    actions: ActionHandlers,
    private readonly gridListService: GridListService,
    private readonly sessionHostFactory: SessionHostFactory,
  ) {
    for (const action of SESSION_ACTIONS) {
      actions.handle(action, () => this.delegate(action));
    }
  }

  private delegate(action: CoreActionName): Promise<boolean> | boolean {
    const terminalId = this.gridListService.getFocusedTerminalId();
    if (!terminalId) {
      return false;
    }
    return (
      this.sessionHostFactory.getSessionKeybindings(terminalId)?.performAction(action) ?? false
    );
  }
}
