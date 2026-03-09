import {
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { AssetCommandSpecRegistry } from "./spec/asset-command-spec.registry";
import { FilesystemSpecProvider } from "./spec/providers/filesystem.spec-provider";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";

export const openFeatureTerminalAutocompleteSuggestorDefinitions: ReadonlyArray<
  TerminalAutocompleteSuggestorDefinitionContract
> = [
  {
    id: "open-features:spec-command",
    createSuggestor: ({ filesystem }) =>
      new SpecCommandSuggestor(
        new AssetCommandSpecRegistry(),
        [new NpmScriptsSpecProvider(filesystem), new FilesystemSpecProvider(filesystem)],
      ),
  },
];
