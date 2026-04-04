import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const commandPaletteFeatureId = "command-palette";

export const commandPaletteSideMenuFeatureDefinition = {
  id: commandPaletteFeatureId,
  title: "Command Palette",
  icon: "mdiPaletteSwatch",
  order: 30,
  actionName: "open_command_palette",
  configPath: "command_palette",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
