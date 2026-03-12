import { fishShellDefinition } from "./fish/fish.shell-definition";
import { gitBashShellDefinition } from "./gitbash/gitbash.shell-definition";

export const proFeatureShellDefinitions = [fishShellDefinition, gitBashShellDefinition] as const;

export const proFeatureShellSupportDefinitions = proFeatureShellDefinitions.map(definition => definition.support);

export const proFeatureShellPathAdapterDefinitions = proFeatureShellDefinitions.map(
  definition => definition.pathAdapter,
);
