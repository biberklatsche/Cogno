import { CommandSpec, ShellConstraint } from "./spec.types";

export type CommandShellConstraints = {
  shells?: ShellConstraint[];
  excludeShells?: ShellConstraint[];
  description?: string;
};

export interface CommandSpecSource {
  commandNames(): Promise<string[]>;
  get(command: string): Promise<CommandSpec | undefined>;
  getConstraints(command: string): Promise<CommandShellConstraints | undefined>;
}
