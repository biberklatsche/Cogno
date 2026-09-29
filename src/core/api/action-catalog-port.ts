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
