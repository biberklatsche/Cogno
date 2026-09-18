import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/shared/contributions";
import { AssetCommandSpecRegistry } from "./spec/asset-command-spec.registry";
import { CommandListSpecProvider } from "./spec/providers/command-list.spec-provider";
import { FilesystemSpecProvider } from "./spec/providers/filesystem.spec-provider";
import { GitBranchesSpecProvider } from "./spec/providers/git-branches.spec-provider";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";
import { SpecSuggestionProvider } from "./spec/spec.types";
import { SpecCommandSuggestor } from "./spec-command.suggestor";

function createDefaultProviderRegistrations(
  filesystem: Parameters<
    NonNullable<typeof specCommandSuggestorDefinition.createSuggestor>
  >[0]["filesystem"],
  commandRunner: Parameters<
    NonNullable<typeof specCommandSuggestorDefinition.createSuggestor>
  >[0]["commandRunner"],
): SpecSuggestionProvider[] {
  return [
    new NpmScriptsSpecProvider(filesystem),
    new FilesystemSpecProvider(filesystem),
    new GitBranchesSpecProvider(commandRunner),
    new CommandListSpecProvider(commandRunner),
  ];
}

export const specCommandSuggestorDefinition: TerminalAutocompleteSuggestorDefinitionContract = {
  id: "features:spec-command",
  createSuggestor: ({ filesystem, commandRunner, issueReporter, getProviderTimeoutMs }) =>
    new SpecCommandSuggestor(
      new AssetCommandSpecRegistry(),
      createDefaultProviderRegistrations(filesystem, commandRunner),
      issueReporter,
      getProviderTimeoutMs,
    ),
};
