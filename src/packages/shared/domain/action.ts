export interface ActionTriggerContract {
  readonly broadcast: boolean;
  readonly unconsumed: boolean;
  readonly performable: boolean;
  readonly always: boolean;
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

export type ActionContextContract = {
  readonly args?: ReadonlyArray<string>;
  readonly terminalId?: string;
};
