import { ShellDefinitionContract } from "@cogno/core-api";
import { zshShellPathAdapterDefinition } from "./zsh.path-adapter";
import { zshShellSupportDefinition } from "./zsh.shell-support-definition";

export const zshShellDefinition: ShellDefinitionContract = {
  support: zshShellSupportDefinition,
  pathAdapter: zshShellPathAdapterDefinition,
};



