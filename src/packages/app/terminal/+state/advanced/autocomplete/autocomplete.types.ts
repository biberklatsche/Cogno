import {
    AutocompleteMatchRangeContract,
    AutocompleteQueryContextContract,
    AutocompleteSuggestionContract,
    ShellContextContract,
} from "@cogno/core-api";
import { TerminalState } from "../../state";

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

export type BaseQueryContext = Extract<AutocompleteQueryContextContract, { shellContext: ShellContextContract }>;
export type CdQueryContext = Extract<AutocompleteQueryContextContract, { mode: "cd" }>;
export type CommandQueryContext = Extract<AutocompleteQueryContextContract, { mode: "command" }>;
export type QueryContext = AutocompleteQueryContextContract;



