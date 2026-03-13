import { bashShellDefinition } from "./bash/bash.shell-definition";
import { powerShellShellDefinition } from "./powershell/powershell.shell-definition";
import { zshShellDefinition } from "./zsh/zsh.shell-definition";

export const featureShellDefinitions = [
  bashShellDefinition,
  zshShellDefinition,
  powerShellShellDefinition,
] as const;

export const featureShellSupportDefinitions = featureShellDefinitions.map(
  definition => definition.support,
);

export const featureShellPathAdapterDefinitions = featureShellDefinitions.map(
  definition => definition.pathAdapter,
);
