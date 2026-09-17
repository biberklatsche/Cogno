import { Injectable } from "@angular/core";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { CoreActionName } from "@cogno/core/workbench/actions/catalog";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ActionKeybindingPort } from "@cogno/shared/ports";
import { ContextMenuItem } from "@cogno/shared/ui";
import { SessionNotifications } from "./session-notifications";

/**
 * The context and header menus of one terminal. They fire catalogue actions
 * (split, maximize, close) aimed at this terminal; an app concern, so this
 * sits with the session's other app-facing collaborators, not in the session.
 * Process info is now the process-info feature panel (step 25).
 */
@Injectable()
export class SessionMenus {
  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly notifications: SessionNotifications,
    private readonly keybindings: ActionKeybindingPort,
  ) {}

  buildContextMenu(): ContextMenuItem[] {
    const terminalId = this.host.terminalId;
    // The menu is one more source of actions, aimed at its own terminal.
    const action = (actionName: CoreActionName) => () =>
      this.bus.publish(ActionFired.create(actionName, undefined, undefined, terminalId));

    const items: ContextMenuItem[] = [
      {
        label: "Paste",
        action: () => {
          this.host.focus();
          action("paste")();
        },
        keybinding: this.keybindingFor("paste"),
      },
      { separator: true },
      {
        label: "Split Right",
        action: action("split_right"),
        keybinding: this.keybindingFor("split_right"),
      },
      {
        label: "Split Left",
        action: action("split_left"),
        keybinding: this.keybindingFor("split_left"),
      },
      {
        label: "Split Down",
        action: action("split_down"),
        keybinding: this.keybindingFor("split_down"),
      },
      {
        label: "Split Up",
        action: action("split_up"),
        keybinding: this.keybindingFor("split_up"),
      },
      { separator: true },
      this.host.model.isPaneMaximized
        ? {
            label: "Minimize",
            action: action("minimize_pane"),
            keybinding: this.keybindingFor("minimize_pane"),
          }
        : {
            label: "Maximize",
            action: action("maximize_pane"),
            keybinding: this.keybindingFor("maximize_pane"),
          },
      { separator: true },
      {
        label: "Clear",
        action: () => {
          this.host.focus();
          action("clear_buffer")();
        },
        keybinding: this.keybindingFor("clear_buffer"),
      },
      {
        label: "Close",
        action: action("close_terminal"),
        keybinding: this.keybindingFor("close_terminal"),
      },
    ];

    if (this.host.hasSelection) {
      items.unshift({
        label: "Copy",
        action: () => {
          this.host.focus();
          action("copy")();
        },
        keybinding: this.keybindingFor("copy"),
      });
    }
    return items;
  }

  buildHeaderMenu(): ContextMenuItem[] {
    return this.notifications.buildNotificationMenuItems();
  }

  buildHeaderCommandMenu(): ContextMenuItem[] {
    return this.host.buildCommandOutOfViewMenu();
  }

  private keybindingFor(actionName: ActionName): string {
    return this.keybindings.getKeybindingLabel(actionName);
  }
}
