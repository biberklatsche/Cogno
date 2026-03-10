import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/core-sdk";
import { specCommandSuggestorDefinition } from "./spec-command/spec-command.suggestor-definition";

export const communityFeatureTerminalAutocompleteSuggestorDefinitions: ReadonlyArray<
  TerminalAutocompleteSuggestorDefinitionContract
> = [specCommandSuggestorDefinition];
