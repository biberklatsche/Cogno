import { CommandSpec } from "../../spec.types";

export const ACT_FIG_SPEC: CommandSpec = {
    name: "act",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/act.ts",
    description: "Run GitHub actions locally",
    subcommands: [
        {
            name: "completion",
            description: "Generate the autocompletion script for the specified shell",
            subcommands: [
                {
                    name: "bash",
                    description: "Generate the autocompletion script for bash",
                    options: [{ name: "--no-descriptions", description: "Disable completion descriptions" }],
                },
                {
                    name: "zsh",
                    description: "Generate the autocompletion script for zsh",
                    options: [{ name: "--no-descriptions", description: "Disable completion descriptions" }],
                },
            ],
        },
        {
            name: "help",
            description: "Help about any command",
            subcommands: [{ name: "completion", description: "Help about completion" }],
        },
    ],
    options: [
        { name: ["--bind", "-b"], description: "Bind working directory to container, rather than copy" },
        { name: ["--eventpath", "-e"], description: "Path to event JSON file", args: { name: "eventpath" } },
        { name: ["--job", "-j"], description: "Run job", args: { name: "job" } },
        { name: ["--list", "-l"], description: "List workflows" },
        { name: ["--watch", "-w"], description: "Watch and run when files change" },
    ],
};
