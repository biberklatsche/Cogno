import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/core-sdk";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./spec/asset-command-spec.registry";
import { CommandListSpecProvider } from "./spec/providers/command-list.spec-provider";
import { FilesystemSpecProvider } from "./spec/providers/filesystem.spec-provider";
import { GitBranchesSpecProvider } from "./spec/providers/git-branches.spec-provider";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";
import { SpecSuggestionProviderRegistration } from "./spec/spec.types";

function createDefaultProviderRegistrations(
  filesystem: Parameters<NonNullable<typeof specCommandSuggestorDefinition.createSuggestor>>[0]["filesystem"],
  commandRunner: Parameters<NonNullable<typeof specCommandSuggestorDefinition.createSuggestor>>[0]["commandRunner"],
): SpecSuggestionProviderRegistration[] {
  return [
    { provider: new NpmScriptsSpecProvider(filesystem) },
    { provider: new FilesystemSpecProvider(filesystem) },
    { provider: new GitBranchesSpecProvider(commandRunner) },
    { provider: new CommandListSpecProvider(commandRunner) },
  ];
}

export const specCommandSuggestorDefinition: TerminalAutocompleteSuggestorDefinitionContract = {
  id: "features:spec-command",
  createSuggestor: ({ filesystem, commandRunner }) =>
    new SpecCommandSuggestor(
      new AssetCommandSpecRegistry(),
      createDefaultProviderRegistrations(filesystem, commandRunner),
    ),
};
