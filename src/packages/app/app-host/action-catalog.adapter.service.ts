import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import {
  ActionCatalog,
  ActionDefinitionContract,
  ActionDispatcher,
  ActionEntryContract,
} from "@cogno/core-api";
import { map, Observable } from "rxjs";
import { ActionFired } from "../action/action.models";
import { coreActionNames } from "../action/core-action-names";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { KeybindService } from "../keybinding/keybind.service";

@Injectable({ providedIn: "root" })
export class ActionCatalogAdapterService implements ActionCatalog, ActionDispatcher {
  readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;

  constructor(
    private readonly appBus: AppBus,
    configService: ConfigService,
    private readonly keybindService: KeybindService,
    private readonly wiringService: AppWiringService,
  ) {
    this.actionEntries$ = configService.config$.pipe(map(() => this.buildActionEntries()));
  }

  dispatchAction(actionDefinition: ActionDefinitionContract): void {
    this.appBus.publish(
      ActionFired.create(
        actionDefinition.actionName,
        actionDefinition.trigger,
        actionDefinition.args ? [...actionDefinition.args] : undefined,
      ),
    );
  }

  private buildActionEntries(): ReadonlyArray<ActionEntryContract> {
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
