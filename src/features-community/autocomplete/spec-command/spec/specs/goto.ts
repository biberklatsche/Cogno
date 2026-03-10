import type { CommandSpec, Generator, Suggestion } from "../spec.types";
const listTargets: Generator = {
    custom: async (tokens, executeShellCommand, context) => {
        const { stdout } = await executeShellCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${context.environmentVariables["HOME"]}/.config/goto`],
        });
        const targetSuggestions = new Map<string, Suggestion>();
        for (const target of stdout.split("\n")) {
            const splits = target.split(" ");
            targetSuggestions.set(target, {
                name: splits[0],
                description: "Goto " + splits[1],
                icon: "🔖",
                priority: 80,
            });
        }
        return [...targetSuggestions.values()];
    },
};
const completionSpec: CommandSpec = {
    name: "goto",
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for goto"
        },
        {
            name: ["--register", "-r"],
            description: "Registers an alias",
            args: [
                {
                    name: "alias"
                },
                {
                    name: "target"
                }
            ]
        },
        {
            name: ["--unregister", "-u"],
            description: "Unregister an alias",
            args: {
                name: "alias"
            }
        },
        {
            name: ["--push", "-p"],
            description: "Pushes the current directory onto the stack, then performs goto"
        },
        {
            name: ["--pop", "-o"],
            description: "Pops the top directory from the stack, then changes to that directory"
        },
        {
            name: ["--list", "-l"],
            description: "Pops the top directory from the stack, then changes to that directory"
        },
        {
            name: ["--expand", "-x"],
            description: "Expands an alias",
            args: {
                name: "alias"
            }
        },
        {
            name: ["--cleanup", "-c"],
            description: "Cleans up non existent directory aliases"
        },
        {
            name: ["--version", "-v"],
            description: "Displays the version of the goto script"
        }
    ]
};
export default completionSpec;
