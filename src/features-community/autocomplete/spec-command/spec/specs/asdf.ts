import type { CommandSpec, Generator, SubcommandSpec, Suggestion } from "../spec.types";
const PRIORITY_TOP_THRESHOLD = 76;
const HOUR_IN_MILLISECONDS = 3600000;
/*
 *  Generators
 */
const installedPluginNamesGenerator = (suggestOptions?: Partial<Suggestion>): Generator => ({
    script: ["asdf", "plugin-list"],
    postProcess: (output) => output.split("\n").map((pluginName) => ({
        name: `${pluginName}`,
        description: "Plugin name",
        priority: PRIORITY_TOP_THRESHOLD,
        icon: "fig://icon?type=package",
        ...suggestOptions,
    })),
});
const allPluginNamesGenerator = (suggestOptions?: Partial<Suggestion>): Generator => ({
    // If use `asdf plugin-list-all`, it will time out, so use `ls`.
    custom: async (_, executeCommand, generatorContext) => {
        const { stdout } = await executeCommand({
            command: "ls",
            args: [
                "-1",
                `${generatorContext.environmentVariables["HOME"]}/.asdf/repository/plugins`
            ],
        });
        return stdout.split("\n").map((pluginName) => ({
            name: `${pluginName}`,
            description: "Plugin name",
            priority: PRIORITY_TOP_THRESHOLD,
            icon: "fig://icon?type=package",
            ...suggestOptions,
        }));
    },
});
const installedPluginVersionsGenerator = (suggestOptions?: Partial<Suggestion>, generatorOptions?: Partial<Generator>): Generator => ({
    script: (context) => {
        const pluginName = context[context.length - 2];
        return ["asdf", "list", pluginName];
    },
    postProcess: (output) => output
        .split("\n")
        .reverse()
        .map((pluginVersion) => ({
        name: `${pluginVersion}`.trim(),
        description: "Plugin version",
        priority: PRIORITY_TOP_THRESHOLD,
        icon: "fig://icon?type=commit",
        ...suggestOptions,
    })),
    ...generatorOptions,
});
const allPluginVersionsGenerator = (suggestOptions?: Partial<Suggestion>, generatorOptions?: Partial<Generator>): Generator => ({
    script: (context) => {
        const pluginName = context[context.length - 2];
        return ["asdf", "list-all", pluginName];
    },
    cache: {
        ttl: HOUR_IN_MILLISECONDS,
    },
    postProcess: (output) => output
        .split("\n")
        .reverse()
        .map((pluginVersion) => ({
        name: `${pluginVersion}`.trim(),
        description: "Plugin version",
        priority: PRIORITY_TOP_THRESHOLD,
        icon: "fig://icon?type=commit",
        ...suggestOptions,
    })),
    ...generatorOptions,
});
const shimNamesGenerator = (suggestOptions?: Partial<Suggestion>): Generator => ({
    // Use `ls` because there is no command to get shims in `asdf`.
    custom: async (_, executeCommand, generatorContext) => {
        const { stdout } = await executeCommand({
            command: "ls",
            args: [
                "-1",
                `${generatorContext.environmentVariables["HOME"]}/.asdf/shims`
            ],
        });
        return stdout.split("\n").map((shimName) => ({
            name: `${shimName}`,
            description: "Shim name",
            priority: PRIORITY_TOP_THRESHOLD,
            icon: "fig://icon?type=command",
            ...suggestOptions,
        }));
    },
});
/*
 *  Reusable specs
 */
const pluginAddSpec: Omit<SubcommandSpec, "name"> = {
    description: "Add a plugin from the plugin repo OR, add a Git repo as a plugin by specifying the name and repo url",
    args: [
        {
            name: "name"
        },
        {
            name: "git-url"
        }
    ],
};
const pluginListAllSpec: Omit<SubcommandSpec, "name"> = {
    description: "List plugins registered on asdf-plugins repository with URLs",
};
const pluginListSpec: Omit<SubcommandSpec, "name"> = {
    description: "List installed plugins. Optionally show git urls and git-ref",
    options: [
        {
            name: "--urls",
            description: "Show git urls"
        },
        {
            name: "--refs",
            description: "Show git refs"
        }
    ],
    subcommands: [
        {
            name: "all",
            ...pluginListAllSpec
        }
    ],
};
const pluginRemoveSpec: Omit<SubcommandSpec, "name"> = {
    description: "Remove plugin and package versions",
    args: {
        name: "name"
    },
};
const pluginUpdateSpec: Omit<SubcommandSpec, "name"> = {
    description: "Update a plugin to latest commit on default branch or a particular git-ref",
    args: [
        {
            name: "name"
        },
        {
            name: "git-ref"
        }
    ],
    options: [
        {
            name: "--all",
            description: "Update all plugins to latest commit on default branch"
        }
    ],
};
const listAllSpec: Omit<SubcommandSpec, "name"> = {
    description: "List all available (remote) versions of a package",
    args: [
        {
            name: "name"
        },
        {
            name: "version"
        }
    ],
};
const shimVersionsSpec: Omit<SubcommandSpec, "name"> = {
    description: "List for given command which plugins and versions provide it",
    args: {
        name: "command"
    },
};
/*
 *  Completion spec
 */
const completionSpec: CommandSpec = {
    name: "asdf",
    description: "Extendable version manager with support for Ruby, Node.js, Elixir, Erlang & more",
    subcommands: [
        {
            name: "plugin",
            description: "Plugin management sub-commands",
            subcommands: [
                {
                    name: "add",
                    ...pluginAddSpec
                },
                {
                    name: "list",
                    ...pluginListSpec
                },
                {
                    name: "remove",
                    ...pluginRemoveSpec
                },
                {
                    name: "update",
                    ...pluginUpdateSpec
                }
            ]
        },
        {
            name: "plugin-add",
            ...pluginAddSpec
        },
        {
            name: "plugin-list",
            ...pluginListSpec
        },
        {
            name: "plugin-list-all",
            ...pluginListAllSpec
        },
        {
            name: "plugin-remove",
            ...pluginRemoveSpec
        },
        {
            name: "plugin-update",
            ...pluginUpdateSpec
        },
        {
            name: "install",
            description: "Install plugin at stated version, or all from .tools-versions",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "uninstall",
            description: "Remove a specific version of a package",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "current",
            description: "Display current versions for named package (else all)",
            args: {
                name: "name"
            }
        },
        {
            name: "where",
            description: "Display install path for given package at optional specified version",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "which",
            description: "Display path to an executable",
            args: {
                name: "command"
            }
        },
        {
            name: "local",
            description: "Set package local version",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "global",
            description: "Set package global version",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "shell",
            description: "Set the package version to ASDF_${LANG}_VERSION` in the current shell",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "latest",
            description: "Display latest version available to install for a named package",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "list",
            description: "List installed versions of a package",
            args: {
                name: "name"
            },
            subcommands: [
                {
                    name: "all",
                    ...listAllSpec
                }
            ]
        },
        {
            name: "list-all",
            ...listAllSpec
        },
        {
            name: "help",
            description: "Output documentation for plugin and tool",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "exec",
            description: "Executes the command shim for the current version",
            args: {
                name: "command"
            }
        },
        {
            name: "env",
            description: "Prints or runs an executable under a command environment",
            args: {
                name: "command"
            }
        },
        {
            name: "info",
            description: "Print os, shell and asdf debug information"
        },
        {
            name: "reshim",
            description: "Recreate shims for version of a package",
            args: [
                {
                    name: "name"
                },
                {
                    name: "version"
                }
            ]
        },
        {
            name: "shim",
            description: "Shim management sub-commands",
            subcommands: [
                {
                    name: "versions",
                    ...shimVersionsSpec
                }
            ]
        },
        {
            name: "shim-versions",
            ...shimVersionsSpec
        },
        {
            name: "update",
            description: "Update ASDF to the latest stable release (unless --head)",
            options: [
                {
                    name: "--head",
                    description: "Using HEAD commit"
                }
            ]
        },
        {
            name: "version",
            description: "Version for asdf"
        }
    ],
    options: [
        {
            name: "--version",
            description: "Version for asdf"
        },
        {
            name: ["-h", "--help"],
            description: "Help for asdf"
        }
    ]
};
export default completionSpec;
