import { Injectable } from "@angular/core";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { OsPlatform } from "@cogno/platform/os";
import { ActionKeybindingPort } from "@cogno/shared/ports";
import { ContextMenuItem, DialogRef, DialogService } from "@cogno/shared/ui";
import {
  TerminalSystemInfoDialogComponent,
  TerminalSystemInfoDialogData,
} from "../system-info/terminal-system-info-dialog.component";
import { SessionNotifications } from "./session-notifications";

/**
 * The context and header menus of one terminal. They issue workbench
 * commands (split, maximize, close) on the old bus and open the process
 * info dialog; both are app concerns, so this sits with the session's other
 * app-facing collaborators, not in the session. The process info dialog
 * leaves with phase F (ARCHITECTURE.md 2.2).
 */
@Injectable()
export class SessionMenus {
  private processInfoDialogReference?: DialogRef<void>;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly notifications: SessionNotifications,
    private readonly keybindings: ActionKeybindingPort,
    private readonly os: OsPlatform,
    private readonly dialog: DialogService,
  ) {}

  dispose(): void {
    this.processInfoDialogReference?.close();
    this.processInfoDialogReference = undefined;
  }

  buildContextMenu(): ContextMenuItem[] {
    const terminalId = this.host.terminalId;
    const paneAction =
      (
        type:
          | "SplitPaneRight"
          | "SplitPaneLeft"
          | "SplitPaneDown"
          | "SplitPaneUp"
          | "MinimizePane"
          | "MaximizePane"
          | "ClearBuffer"
          | "RemovePane"
          | "Paste",
      ) =>
      () =>
        this.bus.publish({ path: ["app", "terminal"], type, payload: terminalId });

    const items: ContextMenuItem[] = [
      {
        label: "Paste",
        action: () => {
          this.host.focus();
          paneAction("Paste")();
        },
        keybinding: this.keybindingFor("paste"),
      },
      { separator: true },
      {
        label: "Split Right",
        action: paneAction("SplitPaneRight"),
        keybinding: this.keybindingFor("split_right"),
      },
      {
        label: "Split Left",
        action: paneAction("SplitPaneLeft"),
        keybinding: this.keybindingFor("split_left"),
      },
      {
        label: "Split Down",
        action: paneAction("SplitPaneDown"),
        keybinding: this.keybindingFor("split_down"),
      },
      {
        label: "Split Up",
        action: paneAction("SplitPaneUp"),
        keybinding: this.keybindingFor("split_up"),
      },
      { separator: true },
      this.host.model.isPaneMaximized
        ? {
            label: "Minimize",
            action: paneAction("MinimizePane"),
            keybinding: this.keybindingFor("minimize_pane"),
          }
        : {
            label: "Maximize",
            action: paneAction("MaximizePane"),
            keybinding: this.keybindingFor("maximize_pane"),
          },
      { separator: true },
      {
        label: "Clear",
        action: () => {
          this.host.focus();
          paneAction("ClearBuffer")();
        },
        keybinding: this.keybindingFor("clear_buffer"),
      },
      {
        label: "Close",
        action: paneAction("RemovePane"),
        keybinding: this.keybindingFor("close_terminal"),
      },
      { separator: true },
      { label: "Process Info", action: () => this.openProcessInfoDialog() },
    ];

    if (this.host.hasSelection) {
      items.unshift({
        label: "Copy",
        action: () => {
          this.host.focus();
          this.bus.publish({ path: ["app", "action"], type: "ActionFired", payload: "copy" });
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

  private openProcessInfoDialog(): void {
    const terminalId = this.host.terminalId;
    if (!terminalId) {
      return;
    }

    this.processInfoDialogReference?.close();
    this.processInfoDialogReference = this.dialog.open<TerminalSystemInfoDialogData, void>(
      TerminalSystemInfoDialogComponent,
      {
        title: "Terminal System Info",
        maxWidth: "100vw",
        hasBackdrop: false,
        movable: true,
        resizable: true,
        showCloseButton: true,
        position: { right: "16px", bottom: "16px" },
        data: {
          terminalId,
          systemInfo: { state$: this.host.state$, commands$: this.host.model.commands$ },
          getProcessTree: () => this.host.getProcessTree(),
        },
      },
    );
  }
}
