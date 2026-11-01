import type { ActionDefinitionContract, ActionEntryContract } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export abstract class ActionCatalog {
  abstract readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
}

export abstract class ActionDispatcher {
  abstract dispatchAction(actionDefinition: ActionDefinitionContract): void;
}
