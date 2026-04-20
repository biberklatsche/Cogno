import {
  AutocompleteQueryContextContract,
  BackendOsContract,
  ShellTypeContract,
} from "@cogno/core-api";

export type ShellConstraint = ShellTypeContract;

export type ArgSpec = {
  name: string;
  description?: string;
};

export type OptionSpec = {
  name: string | string[];
  description?: string;
  args?: ArgSpec | ArgSpec[];
  isRepeatable?: boolean;
  providers?: SpecProviderBinding[];
};

export type SubcommandSpec = {
  name: string | string[];
  description?: string;
  args?: ArgSpec | ArgSpec[];
  providers?: SpecProviderBinding[];
  subcommands?: Array<string | SubcommandSpec>;
  options?: Array<string | OptionSpec>;
};

export type CommandSpec = {
  name: string;
  description?: string;
  subcommands?: Array<string | SubcommandSpec>;
  options?: Array<string | OptionSpec>;
  subcommandOptions?: Record<string, string[]>;
  providers?: SpecProviderBinding[];
  shells?: ShellConstraint[];
  excludeShells?: ShellConstraint[];
};

export type SpecProviderWhen = {
  firstArgIn?: string[];
  argsRegex?: string;
  minArgs?: number;
  maxArgs?: number;
};

export type FilesystemSpecProviderParams = {
  kinds?: Array<"file" | "directory">;
  appendSlashToDirectories?: boolean;
  continueSuggestions?: boolean;
};

export type CommandListSpecProviderParams = {
  program: string;
  args?: string[];
  limit?: number;
  labelField?: number;
  descriptionField?: number;
  stripLabelPrefix?: string;
  itemLabel?: string;
};

type SpecProviderBindingBase<TProviderId extends string, TParams> = {
  providerId: TProviderId;
  when?: SpecProviderWhen;
  source?: string;
  baseScore?: number;
  params?: TParams;
};

export type CommandListSpecProviderBinding = SpecProviderBindingBase<
  "command-list",
  CommandListSpecProviderParams
>;

export type FilesystemSpecProviderBinding = SpecProviderBindingBase<
  "filesystem",
  FilesystemSpecProviderParams
>;

export type GitBranchesSpecProviderBinding = SpecProviderBindingBase<"git-branches", undefined>;

export type NpmScriptsSpecProviderBinding = SpecProviderBindingBase<"npm-scripts", undefined>;

export type ProcessListSpecProviderBinding = SpecProviderBindingBase<"process-list", undefined>;

export type SshHostsSpecProviderBinding = SpecProviderBindingBase<"ssh-hosts", undefined>;

export type SpecProviderBinding =
  | CommandListSpecProviderBinding
  | FilesystemSpecProviderBinding
  | GitBranchesSpecProviderBinding
  | NpmScriptsSpecProviderBinding
  | ProcessListSpecProviderBinding
  | SshHostsSpecProviderBinding;

export type SpecProviderContext = {
  queryContext: AutocompleteQueryContextContract;
  command: string;
  args: string[];
  binding: SpecProviderBinding;
  timeoutMs?: number;
};

export type SpecProvidedSuggestion = {
  label: string;
  insertText?: string;
  description?: string;
  selectedPath?: string;
  completionBehavior?: "final" | "continue";
};

export interface SpecSuggestionProvider {
  readonly id: string;
  suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>>;
}

export type SpecSuggestionProviderRegistration = {
  provider: SpecSuggestionProvider;
  shells?: ShellConstraint[];
  backendOs?: BackendOsContract[];
  priority?: number;
};
