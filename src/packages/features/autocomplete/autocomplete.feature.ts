import { FeatureDefinition } from "@cogno/shared/contributions";
import { specCommandSuggestorDefinition } from "./spec-command/spec-command.suggestor-definition";

export const autocompleteFeature: FeatureDefinition = {
  id: "autocomplete",
  autocompleteSuggestors: [specCommandSuggestorDefinition],
};
