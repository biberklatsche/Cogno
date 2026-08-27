import { bashShellDefinition } from "./bash/bash.shell-definition";
import { powerShellShellDefinition } from "./powershell/powershell.shell-definition";
import { zshShellDefinition } from "./zsh/zsh.shell-definition";

export const shellDefinitions = [
  bashShellDefinition,
  zshShellDefinition,
  powerShellShellDefinition,
] as const;

export const shellSupportDefinitions = shellDefinitions.map((definition) => definition.support);

export const shellPathAdapterDefinitions = shellDefinitions.map(
  (definition) => definition.pathAdapter,
);
