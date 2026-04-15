import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import {
  CommandPaletteActionDefinitionContract,
  CommandPaletteCommandEntryContract,
  CommandPaletteHostPortContract,
} from "@cogno/core-api";
import { map, Observable } from "rxjs";
import { ActionFired } from "../action/action.models";
import { coreActionNames } from "../action/core-action-names";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { KeybindService } from "../keybinding/keybind.service";

@Injectable({ providedIn: "root" })
export class CommandPaletteHostPortAdapterService implements CommandPaletteHostPortContract {
  readonly commandEntries$: Observable<ReadonlyArray<CommandPaletteCommandEntryContract>>;

  constructor(
    private readonly appBus: AppBus,
    configService: ConfigService,
    private readonly keybindService: KeybindService,
    private readonly wiringService: AppWiringService,
  ) {
    this.commandEntries$ = configService.config$.pipe(map(() => this.buildCommandEntries()));
  }

  publishAction(commandPaletteActionDefinition: CommandPaletteActionDefinitionContract): void {
    this.appBus.publish(
      ActionFired.create(
        commandPaletteActionDefinition.actionName,
        commandPaletteActionDefinition.trigger,
        commandPaletteActionDefinition.args ? [...commandPaletteActionDefinition.args] : undefined,
      ),
    );
  }

  private buildCommandEntries(): ReadonlyArray<CommandPaletteCommandEntryContract> {
    const sideMenuActionNames = this.wiringService
      .getSideMenuFeatureDefinitions()
      .map((sideMenuFeatureDefinition) => sideMenuFeatureDefinition.actionName);

    const actionNames = Array.from(
      new Set<string>([
        ...coreActionNames,
        ...this.keybindService.getActionNames(),
        ...sideMenuActionNames,
      ]),
    );

    return actionNames.map((actionName) => {
      const actionDefinition = this.keybindService.getActionDefinition(actionName) ?? {
        actionName,
      };
      return {
        actionDefinition: {
          actionName: actionDefinition.actionName,
          trigger: actionDefinition.trigger,
          args: actionDefinition.args ?? [],
        },
        keybinding: this.keybindService.getKeybinding(actionName) ?? "",
      };
    });
  }
}
