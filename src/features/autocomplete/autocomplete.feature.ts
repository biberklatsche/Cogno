import { FeatureDefinition } from "@cogno/core/api/contributions";
import { specCommandSuggestorDefinition } from "./spec-command/spec-command.suggestor-definition";

export const autocompleteFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: "autocomplete",
  autocompleteSuggestors: [specCommandSuggestorDefinition],
};
