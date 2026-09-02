import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { OsPlatform } from "@cogno/platform/os";
import { ContextMenuItem } from "@cogno/shared/ui";
import { KeybindService } from "../../keybinding/keybind.service";
import { formatKeybinding } from "../../keybinding/pipe/keybinding.pipe";

@Injectable({
  providedIn: "root",
})
export class AppMenuService {
  constructor(
    private readonly os: OsPlatform,
    private readonly bus: AppBus,
    private readonly keybindService: KeybindService,
    private readonly configService: ConfigService,
  ) {}

  public buildMenu(): ContextMenuItem[] {
    const terminalItems = this.configService.getOrderedShellProfiles(9).map((profile, index) => {
      const actionName: ActionName = `open_shell_${index + 1}`;
      return {
        label: profile.name,
        keybinding: this.keybindingFor(actionName),
        action: () => this.bus.publish(ActionFired.create(actionName)),
      } satisfies ContextMenuItem;
    });

    const items: ContextMenuItem[] = [...terminalItems];

    if (terminalItems.length > 0) {
      items.push({ separator: true });
    }

    items.push(this.buildMenuItem("new_window", "New Window"));
    items.push(this.buildMenuItem("open_config", "Settings"));
    items.push({ separator: true });
    items.push({
      label: "Documentation",
      action: () => this.bus.publish(ActionFired.create("open_documentation")),
      keybinding: this.keybindingFor("open_documentation"),
    });
    items.push({
      label: "About Cogno",
      action: () => this.bus.publish(ActionFired.create("open_about")),
      keybinding: this.keybindingFor("open_about"),
    });
    return items;
  }

  private buildMenuItem(actionName: ActionName, text: string): ContextMenuItem {
    return {
      label: text,
      action: () => {
        const actionDef = this.keybindService.getActionDefinition(actionName);
        if (!actionDef) {
          throw new Error(`Action definition ${actionName} not found.`);
        }
        this.bus.publish(ActionFired.createFromDefinition(actionDef));
      },
      keybinding: this.keybindingFor(actionName),
    };
  }

  private keybindingFor(actionName: ActionName): string {
    return formatKeybinding(this.keybindService.getKeybinding(actionName), this.os.platform());
  }
}
