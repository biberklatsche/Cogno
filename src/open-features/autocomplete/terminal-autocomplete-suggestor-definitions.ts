import {
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { FilesystemDirectorySuggestor } from "./filesystem-directory.suggestor";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./spec/asset-command-spec.registry";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";

export const openFeatureTerminalAutocompleteSuggestorDefinitions: ReadonlyArray<
  TerminalAutocompleteSuggestorDefinitionContract
> = [
  {
    id: "open-features:filesystem-directory",
    createSuggestor: ({ filesystem }) => new FilesystemDirectorySuggestor(filesystem),
  },
  {
    id: "open-features:spec-command",
    createSuggestor: ({ filesystem }) =>
      new SpecCommandSuggestor(
        new AssetCommandSpecRegistry(),
        [new NpmScriptsSpecProvider(filesystem)],
      ),
  },
];
