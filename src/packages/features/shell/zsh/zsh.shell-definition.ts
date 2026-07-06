import { ShellDefinitionContract } from "@cogno/core-api";
import { posixInsertSanitizer } from "../common/posix-insert-sanitizer";
import { zshShellPathAdapterDefinition } from "./zsh.path-adapter";
import { zshShellSupportDefinition } from "./zsh.shell-support-definition";

export const zshShellDefinition: ShellDefinitionContract = {
  support: zshShellSupportDefinition,
  pathAdapter: zshShellPathAdapterDefinition,
  lineEditor: {
    insertSanitizer: posixInsertSanitizer,
    // Available only when the session's capability handshake also reports it
    // (the FIFO channel in integration.zsh came up).
    nativeActionsViaShellIntegration: ["replaceCurrentInput"],
  },
};
