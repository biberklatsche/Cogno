import { Injectable } from "@angular/core";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { OsPlatform } from "@cogno/platform/os";
import { ContextMenuItem, DialogRef, DialogService } from "@cogno/shared/ui";
import { ActionName } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { KeybindService } from "../../keybinding/keybind.service";
import { formatKeybinding } from "../../keybinding/pipe/keybinding.pipe";
import {
  TerminalSystemInfoDialogComponent,
  TerminalSystemInfoDialogData,
} from "../system-info/terminal-system-info-dialog.component";
import { SessionFactBridge } from "./session-fact-bridge";

/**
 * The context and header menus of one terminal. They issue workbench
 * commands (split, maximize, close) on the old bus and open the process
 * info dialog; both are app concerns, so this sits next to the bridge, not
 * in the session. The process info dialog leaves with phase F
 * (ARCHITECTURE.md 2.2).
 */
@Injectable()
export class SessionMenus {
  private processInfoDialogReference?: DialogRef<void>;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly bridge: SessionFactBridge,
    private readonly keybindService: KeybindService,
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
    return this.bridge.buildNotificationMenuItems();
  }

  buildHeaderCommandMenu(): ContextMenuItem[] {
    return this.host.buildCommandOutOfViewMenu();
  }

  private keybindingFor(actionName: ActionName): string {
    return formatKeybinding(this.keybindService.getKeybinding(actionName), this.os.platform());
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
        },
      },
    );
  }
}
