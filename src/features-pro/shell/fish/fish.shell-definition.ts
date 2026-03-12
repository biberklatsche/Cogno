import { ShellDefinitionContract } from "@cogno/core-sdk";
import { fishShellPathAdapterDefinition } from "./fish.path-adapter";
import { fishShellSupportDefinition } from "./fish.shell-support-definition";

export const fishShellDefinition: ShellDefinitionContract = {
  support: fishShellSupportDefinition,
  pathAdapter: fishShellPathAdapterDefinition,
};
