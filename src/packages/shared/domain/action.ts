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

/** One default keybinding for an action: the combo plus its scope flags. */
export interface ActionKeybindingDefaultContract {
  readonly combo: string;
  /** Fires even while the terminal has focus (the `always:` scope). */
  readonly always?: boolean;
  /** Only fires when the action reports it performed something (`performable:`). */
  readonly performable?: boolean;
}

/**
 * The default keybindings of an action per platform. `default` covers windows
 * and linux (which share bindings); `macos` overrides only where it differs.
 */
export interface ActionDefaultKeysContract {
  readonly default: ReadonlyArray<ActionKeybindingDefaultContract>;
  readonly macos?: ReadonlyArray<ActionKeybindingDefaultContract>;
}

/** A single action's entry in the catalog (name, label, description, defaults). */
export interface ActionCatalogEntryContract<TName extends string = string> {
  readonly name: TName;
  readonly label: string;
  readonly description: string;
  readonly defaultKeys?: ActionDefaultKeysContract;
}

/**
 * Declare one action for the catalog. The identity generic keeps each name as a
 * literal type so the catalog can form a union of action names from `as const`.
 */
export function defineAction<TName extends string>(
  entry: ActionCatalogEntryContract<TName>,
): ActionCatalogEntryContract<TName> {
  return entry;
}
