import { Observable } from "rxjs";

export interface CommandPaletteActionTriggerContract {
  readonly all: boolean;
  readonly unconsumed: boolean;
  readonly performable: boolean;
}

export interface CommandPaletteActionDefinitionContract {
  readonly actionName: string;
  readonly trigger?: CommandPaletteActionTriggerContract;
  readonly args?: ReadonlyArray<string>;
}

export interface CommandPaletteCommandEntryContract {
  readonly actionDefinition: CommandPaletteActionDefinitionContract;
  readonly keybinding: string;
}

export interface CommandPaletteHostPortContract {
  readonly commandEntries$: Observable<ReadonlyArray<CommandPaletteCommandEntryContract>>;
  publishAction(commandPaletteActionDefinition: CommandPaletteActionDefinitionContract): void;
}

export abstract class CommandPaletteHostPort implements CommandPaletteHostPortContract {
  abstract readonly commandEntries$: Observable<ReadonlyArray<CommandPaletteCommandEntryContract>>;
  abstract publishAction(
    commandPaletteActionDefinition: CommandPaletteActionDefinitionContract,
  ): void;
}
