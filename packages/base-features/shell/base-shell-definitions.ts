import { bashShellDefinition } from "./bash/bash.shell-definition";
import { powerShellShellDefinition } from "./powershell/powershell.shell-definition";
import { zshShellDefinition } from "./zsh/zsh.shell-definition";

export const baseFeatureShellDefinitions = [
  bashShellDefinition,
  zshShellDefinition,
  powerShellShellDefinition,
] as const;

export const baseFeatureShellSupportDefinitions = baseFeatureShellDefinitions.map(
  definition => definition.support,
);

export const baseFeatureShellPathAdapterDefinitions = baseFeatureShellDefinitions.map(
  definition => definition.pathAdapter,
);
