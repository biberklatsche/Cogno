import type { CommandSpec, Generator } from "../spec.types";
const enviromentVariables: Generator = {
    custom: async (_tokens, _executeCommand, generatorContext) => {
        return Object.values(generatorContext.environmentVariables).map((envVar) => ({
            name: envVar,
            description: "Environment variable",
            icon: "🌎",
        }));
    },
};
const completionSpec: CommandSpec = {
    name: "env",
    description: "Set environment and execute command, or print environment",
    options: [
        {
            name: "-0",
            description: "End each output line with NUL, not newline"
        },
        {
            name: ["-i", "-"],
            description: "Start with an empty environment"
        },
        {
            name: "-v",
            description: "Print verbose logs"
        },
        {
            name: "-u",
            description: "Remove variable from the environment",
            args: {
                name: "name"
            }
        },
        {
            name: "-P",
            description: "Search the given directories for the utility, rather than the PATH",
            args: {
                name: "altpath"
            }
        },
        {
            name: "-S",
            description: "Split the given string into separate arguments",
            args: {
                name: "string"
            }
        }
    ]
};
export default completionSpec;
