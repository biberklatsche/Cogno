import { CommandRunnerContract } from "./command-runner.contract";
import { FilesystemContract, ShellContextContract, ShellTypeContract } from "./filesystem.contract";

export type AutocompleteMatchRangeContract = {
  start: number;
  end: number;
};

export type AutocompleteSuggestionContract = {
  label: string;
  description?: string;
  insertText: string;
  score: number;
  source: string;
  replaceStart: number;
  replaceEnd: number;
  matchRanges?: AutocompleteMatchRangeContract[];
  selectedPath?: string;
  selectedCommand?: string;
  selectedPatternSignature?: string;
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

export type AutocompleteQueryContextContract =
  | CdAutocompleteQueryContextContract
  | CommandAutocompleteQueryContextContract;

export type QueryContext = AutocompleteQueryContextContract;

export interface TerminalAutocompleteSuggestorContract {
  readonly id: string;
  readonly inputPattern: RegExp;
  matches(context: AutocompleteQueryContextContract): boolean;
  suggest(context: AutocompleteQueryContextContract): Promise<AutocompleteSuggestionContract[]>;
  warmUpForShellIntegration?(shellType: ShellTypeContract): Promise<void> | void;
}

export interface TerminalAutocompleteSuggestorDependenciesContract {
  readonly filesystem: FilesystemContract;
  readonly commandRunner: CommandRunnerContract;
}

export interface TerminalAutocompleteSuggestorDefinitionContract {
  readonly id: string;
  createSuggestor(
    dependencies: TerminalAutocompleteSuggestorDependenciesContract,
  ): TerminalAutocompleteSuggestorContract;
}
