import { ShellDefinitionContract } from "@cogno/core-api";
import { posixInsertSanitizer } from "../common/posix-insert-sanitizer";
import { bashShellPathAdapterDefinition } from "./bash.path-adapter";
import { bashShellSupportDefinition } from "./bash.shell-support-definition";

export const bashShellDefinition: ShellDefinitionContract = {
  support: bashShellSupportDefinition,
  pathAdapter: bashShellPathAdapterDefinition,
  lineEditor: {
    insertSanitizer: posixInsertSanitizer,
  },
};
