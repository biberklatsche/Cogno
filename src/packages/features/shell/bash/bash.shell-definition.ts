import { ShellDefinitionContract } from "@cogno/core-api";
import { posixInsertSanitizer } from "../common/posix-insert-sanitizer";
import { bashShellPathAdapterDefinition } from "./bash.path-adapter";
import { bashShellSupportDefinition } from "./bash.shell-support-definition";

export const bashShellDefinition: ShellDefinitionContract = {
  support: bashShellSupportDefinition,
  pathAdapter: bashShellPathAdapterDefinition,
  lineEditor: {
    insertSanitizer: posixInsertSanitizer,
    // Available only when the session's capability handshake also reports it
    // (the bind -x trigger channel in integration.bash came up, bash >= 4.0).
    nativeActionsViaShellIntegration: ["replaceCurrentInput"],
  },
};
