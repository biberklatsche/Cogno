import { Injectable } from "@angular/core";
import { ActionKeybindingPort } from "@cogno/core/infrastructure/keybindings/action-keybinding-port";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { actionLabel, CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { PaneLayoutLookup } from "@cogno/core/workbench/grid-list/+state/pane-layout-lookup";
import { ContextMenuItem } from "@cogno/shared/ui";

/** The notification feature's panel action; a feature action, so not in the core catalogue. */
const OPEN_NOTIFICATION_ACTION: ActionName = "open_notification";

/**
 * The context and header menus of one terminal. They fire catalogue actions
 * (split, maximize, close) aimed at this terminal; an app concern, so this
 * sits with the session's other app-facing collaborators, not in the session.
 */
@Injectable()
export class SessionMenus {
  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly keybindings: ActionKeybindingPort,
    private readonly layout: PaneLayoutLookup,
  ) {}

  buildContextMenu(): ContextMenuItem[] {
    const terminalId = this.host.terminalId;
    // The menu is one more source of actions, aimed at its own terminal. An
    // entry is named after its action; `focusFirst` hands the keyboard back to
    // the terminal the entry acts on.
    const item = (actionName: CoreActionName, focusFirst = false): ContextMenuItem => ({
      label: actionLabel(actionName),
      action: () => {
        if (focusFirst) this.host.focus();
        this.bus.publish(ActionFired.create(actionName, undefined, undefined, terminalId));
      },
      keybinding: this.keybindingFor(actionName),
    });

    return [
      ...(this.host.hasSelection ? [item("copy", true)] : []),
      item("paste", true),
      { separator: true },
      item("split_right"),
      item("split_left"),
      item("split_down"),
      item("split_up"),
      { separator: true },
      item(terminalId && this.layout.isMaximized(terminalId) ? "minimize_pane" : "maximize_pane"),
      { separator: true },
      item("clear_buffer", true),
      item("close_terminal"),
    ];
  }

  /** The bell carries the unread mark; it opens the notifications, where the message is. */
  openNotifications(): void {
    this.bus.publish(ActionFired.create(OPEN_NOTIFICATION_ACTION));
  }

  buildHeaderCommandMenu(): ContextMenuItem[] {
    return this.host.buildCommandOutOfViewMenu();
  }

  private keybindingFor(actionName: ActionName): string {
    return this.keybindings.getKeybindingLabel(actionName);
  }
}
