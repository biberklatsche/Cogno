import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { CommandPaletteComponent } from "./command-palette.component";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

export const commandPaletteFeatureId = "command-palette";

export const commandPaletteSideMenuFeatureDefinition = {
  id: commandPaletteFeatureId,
  title: "Command Palette",
  icon: "mdiPaletteSwatch",
  order: 30,
  actionName: "open_command_palette",
  targetComponent: CommandPaletteComponent,
  configPath: "command_palette",
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(CommandPaletteSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract<Type<unknown>, string, string>;
