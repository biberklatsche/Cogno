import { bashShellDefinition } from "./bash/bash.shell-definition";
import { powerShellShellDefinition } from "./powershell/powershell.shell-definition";
import { zshShellDefinition } from "./zsh/zsh.shell-definition";

export const communityFeatureShellDefinitions = [
  bashShellDefinition,
  zshShellDefinition,
  powerShellShellDefinition,
] as const;

export const communityFeatureShellSupportDefinitions = communityFeatureShellDefinitions.map(
  definition => definition.support,
);

export const communityFeatureShellPathAdapterDefinitions = communityFeatureShellDefinitions.map(
  definition => definition.pathAdapter,
);
