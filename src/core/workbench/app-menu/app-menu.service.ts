import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { formatKeybinding } from "@cogno/core/infrastructure/keybindings/pipe/keybinding.pipe";
import { actionLabel } from "@cogno/core/workbench/actions/catalog";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { OsPlatform } from "@cogno/platform/os";
import { ContextMenuItem } from "@cogno/shared/ui";

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

    items.push(this.buildMenuItem("new_window"));
    items.push(this.buildMenuItem("open_config"));
    items.push({ separator: true });
    for (const actionName of ["open_documentation", "open_about"]) {
      items.push({
        label: actionLabel(actionName),
        action: () => this.bus.publish(ActionFired.create(actionName)),
        keybinding: this.keybindingFor(actionName),
      });
    }
    return items;
  }

  private buildMenuItem(actionName: ActionName): ContextMenuItem {
    return {
      label: actionLabel(actionName),
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
