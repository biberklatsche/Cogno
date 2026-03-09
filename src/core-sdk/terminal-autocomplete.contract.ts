import { FilesystemContract, ShellContextContract, ShellTypeContract } from "./filesystem.contract";

export type AutocompleteMatchRangeContract = {
  start: number;
  end: number;
};

export type AutocompleteSuggestionContract = {
  label: string;
  description?: string;
  detail?: string;
  insertText: string;
  score: number;
  source: string;
  replaceStart: number;
  replaceEnd: number;
  matchRanges?: AutocompleteMatchRangeContract[];
  selectedPath?: string;
  selectedCommand?: string;
  completionBehavior?: "final" | "continue";
};

export type BaseAutocompleteQueryContextContract = {
  beforeCursor: string;
  inputText: string;
  cursorIndex: number;
  replaceStart: number;
  replaceEnd: number;
  cwd: string;
  shellContext: ShellContextContract;
};

export type CdAutocompleteQueryContextContract = BaseAutocompleteQueryContextContract & {
  mode: "cd";
  fragment: string;
};

export type CommandAutocompleteQueryContextContract = BaseAutocompleteQueryContextContract & {
  mode: "command";
  query: string;
};

export type NpmScriptAutocompleteQueryContextContract = BaseAutocompleteQueryContextContract & {
  mode: "npm-script";
  fragment: string;
};

export type AutocompleteQueryContextContract =
  | CdAutocompleteQueryContextContract
  | CommandAutocompleteQueryContextContract
  | NpmScriptAutocompleteQueryContextContract;

export interface TerminalAutocompleteSuggestorContract {
  readonly id: string;
  readonly inputPattern: RegExp;
  matches(context: AutocompleteQueryContextContract): boolean;
  suggest(context: AutocompleteQueryContextContract): Promise<AutocompleteSuggestionContract[]>;
  warmUpForShellIntegration?(shellType: ShellTypeContract): Promise<void> | void;
}

export interface TerminalAutocompleteSuggestorDependenciesContract {
  readonly filesystem: FilesystemContract;
}

export interface TerminalAutocompleteSuggestorDefinitionContract {
  readonly id: string;
  createSuggestor(
    dependencies: TerminalAutocompleteSuggestorDependenciesContract,
  ): TerminalAutocompleteSuggestorContract;
}
