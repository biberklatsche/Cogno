import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec, Generator, SubcommandSpec, Suggestion } from "../spec.types";
const PRIORITY_TOP_THRESHOLD = 76;
const PRIORITY_BOTTOM_THRESHOLD = 49;
/*
 *  Generators
 */
const envrcFilepathsGenerator = (suggestOptions?: Partial<Suggestion>): Generator => ({
    template: "filepaths",
    filterTemplateSuggestions: (paths) => {
        const isEnvrc = (fileName: string) => fileName.includes(".envrc");
        return paths
            .filter((file) => isEnvrc(file.name) || file.name.endsWith("/"))
            .map((file) => ({
            ...file,
            priority: isEnvrc(file.name) && PRIORITY_TOP_THRESHOLD,
            ...suggestOptions,
        }));
    },
});
const dotenvFilepathsGenerator = filepaths({
    matches: /\.env(?!rc)/g,
    editFileSuggestions: { priority: PRIORITY_TOP_THRESHOLD },
});
/*
 *  Reusable suggestions
 */
const shellSuggestions: Partial<Suggestion>[] = [
    "bash",
    "zsh",
    "fish",
    "tcsh",
    "elvish"
].map((shell) => ({
    name: shell,
    icon: "🐚",
}));
/*
 *  Reusable specs
 */
const helpSpec: Partial<SubcommandSpec> = {
    description: "Help for direnv",
    args: {
        name: "SHOW_PRIVATE",
        description: "Any string"
    },
};
const versionSpec: Partial<SubcommandSpec> = {
    description: "Prints the version or checks that direnv is older than VERSION_AT_LEAST",
    args: {
        name: "VERSION_AT_LEAST"
    },
};
/*
 *  Completion spec
 */
const completionSpec: CommandSpec = {
    name: "direnv",
    description: "Unclutter your .profile",
    subcommands: [
        {
            name: "allow",
            description: "Grants direnv to load the given .envrc",
            args: {
                name: "PATH_TO_RC"
            }
        },
        {
            name: "deny",
            description: "Revokes the authorization of a given .envrc",
            args: {
                name: "PATH_TO_RC"
            }
        },
        {
            name: "edit",
            description: "Opens PATH_TO_RC or the current .envrc into an $EDITOR and allow the file to be loaded afterwards",
            args: {
                name: "PATH_TO_RC"
            }
        },
        {
            name: "exec",
            description: "Executes a command after loading the first .envrc found in DIR",
            args: [
                {
                    name: "DIR"
                },
                {
                    name: "COMMAND"
                }
            ]
        },
        {
            name: "fetchurl",
            description: "Fetches a given URL into direnv's CAS",
            args: [
                {
                    name: "url"
                },
                {
                    name: "integrity-hash",
                    description: "Check if the `integrity hash` is equal to the hash value of the file obtained from the `url`"
                }
            ]
        },
        {
            name: "help",
            ...helpSpec
        },
        {
            name: "hook",
            description: "Used to setup the shell hook",
            args: {
                name: "SHELL"
            }
        },
        {
            name: "prune",
            description: "Removes old allowed files"
        },
        {
            name: "reload",
            description: "Triggers an env reload"
        },
        {
            name: "status",
            description: "Prints some debug status information"
        },
        {
            name: "stdlib",
            description: "Displays the stdlib available in the .envrc execution context"
        },
        {
            name: "version",
            ...versionSpec
        },
        {
            name: "apply_dump",
            description: "Accepts a filename containing `direnv dump` output and generates a series of bash export statements to apply the given env",
            args: {
                name: "FILE"
            }
        },
        {
            name: "show_dump",
            description: "Show the data inside of a dump for debugging purposes",
            args: {
                name: "DUMP"
            }
        },
        {
            name: "dotenv",
            description: "Transforms a .env file to evaluatable `export KEY=PAIR` statements",
            args: [
                {
                    name: "SHELL"
                },
                {
                    name: "PATH_TO_DOTENV"
                }
            ]
        },
        {
            name: "dump",
            description: "Used to export the inner bash state at the end of execution",
            args: [
                {
                    name: "SHELL"
                },
                {
                    name: "FILE",
                    description: "Overwrites by dump data"
                }
            ]
        },
        {
            name: "export",
            description: "Loads an .envrc and prints the diff in terms of exports",
            args: {
                name: "SHELL"
            }
        },
        {
            name: "watch",
            description: "Adds a path to the list that direnv watches for changes",
            args: [
                {
                    name: "SHELL"
                },
                {
                    name: "PATH"
                }
            ]
        },
        {
            name: "watch-dir",
            description: "Recursively adds a directory to the list that direnv watches for changes",
            args: [
                {
                    name: "SHELL"
                },
                {
                    name: "DIR"
                }
            ]
        },
        {
            name: "watch-list",
            description: "Pipe pairs of `mtime path` to stdin to build a list of files to watch",
            args: {
                name: "SHELL"
            }
        },
        {
            name: "current",
            description: "Reports whether direnv's view of a file is current (or stale)",
            args: {
                name: "PATH"
            }
        }
    ],
    options: [
        {
            name: "--version",
            ...versionSpec
        },
        {
            name: "--help",
            ...helpSpec
        }
    ]
};
export default completionSpec;
