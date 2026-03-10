import { ShellPathAdapterDefinitionContract } from "@cogno/core-sdk";
import { bashShellPathAdapterDefinition } from "./bash.path-adapter";
import { powerShellShellPathAdapterDefinition } from "./powershell.path-adapter";
import { zshShellPathAdapterDefinition } from "./zsh.path-adapter";

export const communityFeatureShellPathAdapterDefinitions: ReadonlyArray<ShellPathAdapterDefinitionContract> = [
  bashShellPathAdapterDefinition,
  zshShellPathAdapterDefinition,
  powerShellShellPathAdapterDefinition,
];
