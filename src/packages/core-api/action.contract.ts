import { Observable } from "rxjs";

export interface ActionTriggerContract {
  readonly all: boolean;
  readonly unconsumed: boolean;
  readonly performable: boolean;
}

export interface ActionDefinitionContract {
  readonly actionName: string;
  readonly trigger?: ActionTriggerContract;
  readonly args?: ReadonlyArray<string>;
}

export interface ActionEntryContract {
  readonly actionDefinition: ActionDefinitionContract;
  readonly keybinding: string;
}

export interface ActionCatalogContract {
  readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
}

export interface ActionDispatcherContract {
  dispatchAction(actionDefinition: ActionDefinitionContract): void;
  onAction$(actionName: string): Observable<void>;
}

export abstract class ActionCatalog implements ActionCatalogContract {
  abstract readonly actionEntries$: Observable<ReadonlyArray<ActionEntryContract>>;
}

export abstract class ActionDispatcher implements ActionDispatcherContract {
  abstract dispatchAction(actionDefinition: ActionDefinitionContract): void;
  abstract onAction$(actionName: string): Observable<void>;
}
