import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionNameRegistry } from "@cogno/core/workbench/actions/action-name-registry";
import { coreActionNames } from "@cogno/core/workbench/actions/core-action-names";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import {
  ActionContextContract,
  ActionDefinitionContract,
  ActionEntryContract,
} from "@cogno/shared/domain";
import { ActionCatalog, ActionDispatcher } from "@cogno/shared/ports";
import { filter, map, Observable, share, tap } from "rxjs";

@Injectable({ providedIn: "root" })
export class ActionCatalogAdapterService implements ActionCatalog, ActionDispatcher {
  readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
  private readonly actionStreams = new Map<string, Observable<void>>();
  private readonly contextStreams = new Map<string, Observable<ActionContextContract>>();

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

  onAction$(actionName: string): Observable<void> {
    const cached = this.actionStreams.get(actionName);
    if (cached) return cached;

    const stream = this.appBus.on$(ActionFired.listener()).pipe(
      filter((event) => event.payload === actionName),
      tap((event) => {
        event.performed = !event.trigger?.broadcast;
        event.defaultPrevented = true;
      }),
      map(() => undefined),
      share(),
    );
    this.actionStreams.set(actionName, stream);
    return stream;
  }

  onActionWithContext$(actionName: string): Observable<ActionContextContract> {
    const cached = this.contextStreams.get(actionName);
    if (cached) return cached;

    const stream = this.appBus.on$(ActionFired.listener()).pipe(
      filter((event) => event.payload === actionName),
      map((event) => ({
        args: event.args ? [...event.args] : undefined,
        terminalId: event.terminalId,
      })),
      share(),
    );
    this.contextStreams.set(actionName, stream);
    return stream;
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
        keybinding: this.keybindService.getKeybinding(actionName) ?? "",
      };
    });
  }
}
