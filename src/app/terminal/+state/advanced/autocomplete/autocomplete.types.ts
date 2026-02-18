import { TerminalState } from "../../state";

export type AutocompleteSuggestionKind = "directory" | "command" | "script";

export type AutocompleteMatchRange = {
    start: number;
    end: number;
};

export type AutocompleteSuggestion = {
    label: string;
    description?: string;
    detail?: string;
    insertText: string;
    score: number;
    source: string;
    kind: AutocompleteSuggestionKind;
    replaceStart: number;
    replaceEnd: number;
    matchRanges?: AutocompleteMatchRange[];
    selectedPath?: string;
    selectedCommand?: string;
};

export type AutocompleteViewState = {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    selectedIndex: number | null;
    suggestions: AutocompleteSuggestion[];
};

export type BaseQueryContext = {
    beforeCursor: string;
    inputText: string;
    cursorIndex: number;
    replaceStart: number;
    replaceEnd: number;
    cwd: string;
    shellContext: TerminalState["shellContext"];
};

export type CdQueryContext = BaseQueryContext & {
    mode: "cd";
    fragment: string;
};

export type CommandQueryContext = BaseQueryContext & {
    mode: "command";
    query: string;
};

export type NpmScriptQueryContext = BaseQueryContext & {
    mode: "npm-script";
    fragment: string;
};

export type QueryContext = CdQueryContext | CommandQueryContext | NpmScriptQueryContext;
