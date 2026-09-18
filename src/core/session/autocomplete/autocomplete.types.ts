import {
  AutocompleteMatchRangeContract,
  AutocompleteQueryContextContract,
  AutocompleteSuggestionContract,
} from "@cogno/shared/contributions";

export type AutocompleteMatchRange = AutocompleteMatchRangeContract;
export type AutocompleteSuggestion = AutocompleteSuggestionContract;

export type AutocompleteViewState = {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  placement: "below" | "above";
  selectedIndex: number | null;
  suggestions: AutocompleteSuggestion[];
};

export type CdQueryContext = Extract<AutocompleteQueryContextContract, { mode: "cd" }>;
export type CommandQueryContext = Extract<AutocompleteQueryContextContract, { mode: "command" }>;
export type QueryContext = AutocompleteQueryContextContract;
