import { TerminalAutocompleteSuggestorDefinitionContract } from "@cogno/shared/contributions";
import { specCommandSuggestorDefinition } from "./spec-command/spec-command.suggestor-definition";

export const featureTerminalAutocompleteSuggestorDefinitions: ReadonlyArray<TerminalAutocompleteSuggestorDefinitionContract> =
  [specCommandSuggestorDefinition];
