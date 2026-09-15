import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { CommandPaletteSideMenuLifecycle } from "./command-palette-side-menu.lifecycle";

const commandPaletteFeatureId = "command-palette";

const commandPaletteSideMenuFeatureDefinition = {
  id: commandPaletteFeatureId,
  title: "Command Palette",
  icon: "mdiPaletteSwatch",
  order: 30,
  actionName: "open_command_palette",
  configPath: "feature.command_palette",
  targetComponent: () =>
    import("./command-palette.component").then((m) => m.CommandPaletteComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(CommandPaletteSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const commandPaletteFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: commandPaletteSideMenuFeatureDefinition.id,
  sideMenu: [commandPaletteSideMenuFeatureDefinition],
};
