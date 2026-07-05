import { ShellDefinitionContract } from "@cogno/core-api";
import { posixInsertSanitizer } from "../common/posix-insert-sanitizer";
import { zshShellPathAdapterDefinition } from "./zsh.path-adapter";
import { zshShellSupportDefinition } from "./zsh.shell-support-definition";

export const zshShellDefinition: ShellDefinitionContract = {
  support: zshShellSupportDefinition,
  pathAdapter: zshShellPathAdapterDefinition,
  lineEditor: {
    insertSanitizer: posixInsertSanitizer,
  },
};
