// Stays in shared/: dual-consumed by core/workbench (cli-action,
// workspace-shortcut) and features (command-palette). A port both the workbench
// and features need cannot move to core/api (ARCHITECTURE.md 6, step 24f).
import type { ActionDefinitionContract, ActionEntryContract } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export interface ActionCatalogContract {
  readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
}

export interface ActionDispatcherContract {
  dispatchAction(actionDefinition: ActionDefinitionContract): void;
}

export abstract class ActionCatalog implements ActionCatalogContract {
  abstract readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
}

export abstract class ActionDispatcher implements ActionDispatcherContract {
  abstract dispatchAction(actionDefinition: ActionDefinitionContract): void;
}
