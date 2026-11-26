import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config } from "@cogno/core/infrastructure/config/models/config";
import { actionLabel } from "@cogno/core/workbench/actions/catalog";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { TauriMenu, TauriMenuItemHandle } from "@cogno/platform/native-menu";
import { OsPlatform } from "@cogno/platform/os";
import { AppWindow } from "@cogno/platform/window";
import { fromEvent } from "rxjs";
import { readFeatureConfig } from "../feature-host/feature-config";

@Injectable({
  providedIn: "root",
})
export class NativeMenuService {
  private latestConfig?: Config;

  constructor(
    private readonly tauriMenu: TauriMenu,
    private readonly appWindow: AppWindow,
    private readonly os: OsPlatform,
    private bus: AppBus,
    private keybindService: KeybindService,
    private readonly featureHost: FeatureHost,
    configService: ConfigService,
    ref: DestroyRef,
  ) {
    if (this.os.platform() === "macos") {
      configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(async (config) => {
        this.latestConfig = config;
        await this.buildMenu();
      });
      this.appWindow.onFocusChanged$.pipe(takeUntilDestroyed(ref)).subscribe(async (focus) => {
        if (focus) {
          await this.buildMenu();
        }
      });
      // Edit > Paste clicked while a terminal has the keyboard would paste
      // natively, past the session: it becomes Cogno's paste instead.
      fromEvent(document, "paste", { capture: true })
        .pipe(takeUntilDestroyed(ref))
        .subscribe((event) => {
          if (!(event.target instanceof Element && event.target.closest(".terminal.xterm"))) return;
          event.preventDefault();
          event.stopPropagation();
          this.fire("paste");
        });
    }
  }

  private async buildMenu() {
    const appSubmenu = await this.tauriMenu.newSubmenu({
      id: "cogno",
      text: "Cogno",
      items: [
        await this.buildMenuItem("open_about"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("open_settings"),
        await this.buildMenuItem("open_config"),
        await this.buildMenuItem("load_config"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("quit"),
      ],
    });

    const fileSubmenu = await this.tauriMenu.newSubmenu({
      text: "File",
      items: [
        await this.buildMenuItem("new_window"),
        await this.buildMenuItem("new_tab"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("split_right"),
        await this.buildMenuItem("split_left"),
        await this.buildMenuItem("split_down"),
        await this.buildMenuItem("split_up"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("close_tab"),
        await this.buildMenuItem("close_other_tabs"),
        await this.buildMenuItem("close_all_tabs"),
      ],
    });

    // The system's own entries: without them macOS routes no Cmd+V, Cmd+C, Cmd+X,
    // Cmd+A or Cmd+Z to a text field, so nothing could be pasted into a dialog.
    // In the terminal these keys never get here: KeybindService keeps them.
    const editSubmenu = await this.tauriMenu.newSubmenu({
      text: "Edit",
      items: await Promise.all(
        (["Undo", "Redo", "Separator", "Cut", "Copy", "Paste", "SelectAll"] as const).map((item) =>
          this.tauriMenu.newPredefinedItem({ item }),
        ),
      ),
    });

    const sideMenuFeatureDefinitions = this.featureHost.getSideMenuFeatureDefinitions();
    const sortedSideMenuFeatureDefinitions = [...sideMenuFeatureDefinitions].sort(
      (firstFeatureDefinition, secondFeatureDefinition) =>
        firstFeatureDefinition.order - secondFeatureDefinition.order,
    );

    const viewMenuItems = await Promise.all(
      sortedSideMenuFeatureDefinitions.map((sideMenuFeatureDefinition) =>
        this.buildMenuItem(
          sideMenuFeatureDefinition.actionName,
          sideMenuFeatureDefinition.title,
          this.isFeatureEnabled(sideMenuFeatureDefinition.configPath),
        ),
      ),
    );

    const viewSubmenu = await this.tauriMenu.newSubmenu({
      text: "View",
      items: viewMenuItems,
    });

    const helpSubmenu = await this.tauriMenu.newSubmenu({
      text: "Help",
      items: [await this.buildMenuItem("open_documentation")],
    });

    const menu = await this.tauriMenu.new({
      items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu, helpSubmenu],
    });
    await menu.setAsAppMenu();
  }

  /** A menu entry is named after its action; a feature's entry after the feature. */
  private async buildMenuItem(
    actionName: ActionName,
    text: string = actionLabel(actionName),
    enabled: boolean = true,
  ): Promise<TauriMenuItemHandle> {
    return await this.tauriMenu.newItem({
      id: actionName,
      text,
      enabled,
      accelerator: this.keybindService.getKeybinding(actionName),
      action: () => this.fire(actionName),
    });
  }

  private fire(actionName: ActionName): void {
    const actionDef = this.keybindService.getActionDefinition(actionName);
    this.bus.publish(ActionFired.create(actionName, actionDef?.trigger, actionDef?.args));
  }

  /** A feature's entry is enabled unless its config says "off". */
  private isFeatureEnabled(configPath: string): boolean {
    return readFeatureConfig(this.latestConfig, configPath)?.["mode"] !== "off";
  }
}
