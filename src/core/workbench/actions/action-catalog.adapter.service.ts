import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import { coreActionLabel, coreActionNames } from "@cogno/core/workbench/actions/catalog";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { ActionDefinitionContract, ActionEntryContract } from "@cogno/shared/domain";
import { ActionCatalog, ActionDispatcher } from "@cogno/shared/ports";
import { map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class ActionCatalogAdapterService implements ActionCatalog, ActionDispatcher {
  readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;

  constructor(
    private readonly appBus: AppBus,
    configService: ConfigService,
    private readonly keybindService: KeybindService,
    private readonly actionNameRegistry: ActionNameRegistry,
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
    const actionNames = Array.from(
      new Set<string>([
        ...coreActionNames,
        ...this.keybindService.getActionNames(),
        ...this.actionNameRegistry.getActionNames(),
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
        label: coreActionLabel(actionName),
        keybinding: this.keybindService.getKeybinding(actionName) ?? "",
      };
    });
  }
}
