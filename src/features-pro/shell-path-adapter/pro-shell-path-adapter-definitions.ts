import { ShellPathAdapterDefinitionContract } from "@cogno/core-sdk";
import { fishShellPathAdapterDefinition } from "./fish.path-adapter";
import { gitBashShellPathAdapterDefinition } from "./gitbash.path-adapter";

export const proFeatureShellPathAdapterDefinitions: ReadonlyArray<ShellPathAdapterDefinitionContract> = [
  fishShellPathAdapterDefinition,
  gitBashShellPathAdapterDefinition,
];
