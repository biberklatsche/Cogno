import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import { bashShellSupportDefinition } from "./bash.shell-support-definition";
import { powerShellShellSupportDefinition } from "./powershell.shell-support-definition";
import { zshShellSupportDefinition } from "./zsh.shell-support-definition";

export const communityFeatureShellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract> = [
  bashShellSupportDefinition,
  zshShellSupportDefinition,
  powerShellShellSupportDefinition,
];
