import type { CommandSpec, Generator, Suggestion } from "../spec.types";
const warpPointsGenerator: Generator = {
    custom: async (_, executeCommand, context) => {
        const { stdout } = await executeCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${context.environmentVariables["HOME"]}/.warprc`],
        });
        // find all warp points names
        const iter = stdout.matchAll(/^(\w+)/gm);
        const suggestions: Suggestion[] = [];
        for (const [point] of iter) {
            suggestions.push({
                name: point,
                description: "Warp point",
                icon: "🔘",
                priority: 76,
            });
        }
        return suggestions;
    },
};
const completionSpec: CommandSpec = {
    name: "wd",
    description: "Warp to directories without using cd",
    subcommands: [
        {
            name: "add",
            description: "Adds the current working directory to your warp points",
            args: {
                name: "point",
                description: "Name of the warp point to be created"
            }
        },
        {
            name: "rm",
            description: "Removes the given warp point",
            args: {
                name: "point",
                description: "Name of the warp point to be removed"
            }
        },
        {
            name: "show",
            description: "Print path to given warp point",
            args: {
                name: "point",
                description: "Name of the warp point"
            }
        },
        {
            name: "list",
            description: "Print all stored warp points"
        },
        {
            name: "ls",
            description: "Show files from given warp point (ls)",
            args: {
                name: "point",
                description: "Name of the warp point"
            }
        },
        {
            name: "path",
            description: "Show the path to given warp point (pwd)",
            args: {
                name: "point",
                description: "Name of the warp point"
            }
        },
        {
            name: "clean",
            description: "Remove points warping to nonexistent directories (will prompt unless --force is used)"
        },
        {
            name: "help",
            description: "Shows help for wd"
        }
    ],
    options: [
        {
            name: ["-v", "--version"],
            description: "Print version"
        },
        {
            name: ["-d", "--debug"],
            description: "Exit after execution with exit codes (for testing)"
        },
        {
            name: ["-c", "--config"],
            description: "Specify config file (default ~/.warprc)",
            args: {
                name: "file"
            }
        },
        {
            name: ["-q", "--quiet"],
            description: "Suppress all output"
        },
        {
            name: ["-f", "--force"],
            description: "Allows overwriting without warning (for add & clean)"
        }
    ]
};
export default completionSpec;
