import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import { fishShellSupportDefinition } from "./fish.shell-support-definition";
import { gitBashShellSupportDefinition } from "./git-bash.shell-support-definition";

export const proFeatureShellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract> = [
  fishShellSupportDefinition,
  gitBashShellSupportDefinition,
];
