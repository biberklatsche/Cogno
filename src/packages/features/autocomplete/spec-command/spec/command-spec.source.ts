import { CommandSpec, ShellConstraint } from "./spec.types";

export type MaybePromise<T> = T | Promise<T>;

export type CommandShellConstraints = {
    shells?: ShellConstraint[];
    excludeShells?: ShellConstraint[];
    description?: string;
};

export interface CommandSpecSource {
    commandNames(): MaybePromise<string[]>;
    get(command: string): MaybePromise<CommandSpec | undefined>;
    getConstraints(command: string): MaybePromise<CommandShellConstraints | undefined>;
}



