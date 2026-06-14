import { Injectable } from "@angular/core";
import { ContextMenuItem } from "@cogno/core-ui";
import { ActionFired, ActionName } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { ConfigService } from "../../config/+state/config.service";
import { KeybindService } from "../../keybinding/keybind.service";
import { formatKeybinding } from "../../keybinding/pipe/keybinding.pipe";

@Injectable({
  providedIn: "root",
})
export class AppMenuService {
  constructor(
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
    return formatKeybinding(this.keybindService.getKeybinding(actionName));
  }
}
