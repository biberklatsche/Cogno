import { ShellDefinitionContract } from "@cogno/core-sdk";
import { zshShellPathAdapterDefinition } from "./zsh.path-adapter";
import { zshShellSupportDefinition } from "./zsh.shell-support-definition";

export const zshShellDefinition: ShellDefinitionContract = {
  support: zshShellSupportDefinition,
  pathAdapter: zshShellPathAdapterDefinition,
};
