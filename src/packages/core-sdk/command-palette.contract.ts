import { InjectionToken } from "@angular/core";
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

export const commandPaletteHostPortToken = new InjectionToken<CommandPaletteHostPortContract>(
  "command-palette-host-port-token",
);
