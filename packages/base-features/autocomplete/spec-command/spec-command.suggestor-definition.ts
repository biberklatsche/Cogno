import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/core-sdk";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./spec/asset-command-spec.registry";
import { CommandListSpecProvider } from "./spec/providers/command-list.spec-provider";
import { FilesystemSpecProvider } from "./spec/providers/filesystem.spec-provider";
import { GitBranchesSpecProvider } from "./spec/providers/git-branches.spec-provider";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";

export const specCommandSuggestorDefinition: TerminalAutocompleteSuggestorDefinitionContract = {
  id: "base-features:spec-command",
  createSuggestor: ({ filesystem, commandRunner }) =>
    new SpecCommandSuggestor(
      new AssetCommandSpecRegistry(),
      [
        new NpmScriptsSpecProvider(filesystem),
        new FilesystemSpecProvider(filesystem),
        new GitBranchesSpecProvider(commandRunner),
        new CommandListSpecProvider(commandRunner),
      ],
    ),
};
