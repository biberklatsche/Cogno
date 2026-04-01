import { ShellDefinitionContract } from "@cogno/core-api";
import { bashShellPathAdapterDefinition } from "./bash.path-adapter";
import { bashShellSupportDefinition } from "./bash.shell-support-definition";

export const bashShellDefinition: ShellDefinitionContract = {
  support: bashShellSupportDefinition,
  pathAdapter: bashShellPathAdapterDefinition,
};



