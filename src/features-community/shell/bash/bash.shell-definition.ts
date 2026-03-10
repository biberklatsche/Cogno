import { ShellDefinitionContract } from "@cogno/core-sdk";
import { bashShellPathAdapterDefinition } from "./bash.path-adapter";
import { bashShellSupportDefinition } from "./bash.shell-support-definition";

export const bashShellDefinition: ShellDefinitionContract = {
  support: bashShellSupportDefinition,
  pathAdapter: bashShellPathAdapterDefinition,
};
