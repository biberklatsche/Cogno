import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/core-api";
import { specCommandSuggestorDefinition } from "./spec-command/spec-command.suggestor-definition";

export const featureTerminalAutocompleteSuggestorDefinitions: ReadonlyArray<
  TerminalAutocompleteSuggestorDefinitionContract
> = [specCommandSuggestorDefinition];



