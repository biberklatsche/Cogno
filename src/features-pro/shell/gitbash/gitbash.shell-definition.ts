import { ShellDefinitionContract } from "@cogno/core-sdk";
import { gitBashShellPathAdapterDefinition } from "./gitbash.path-adapter";
import { gitBashShellSupportDefinition } from "./gitbash.shell-support-definition";

export const gitBashShellDefinition: ShellDefinitionContract = {
  support: gitBashShellSupportDefinition,
  pathAdapter: gitBashShellPathAdapterDefinition,
};
