import type { CommandSpec, Generator } from "../spec.types";
const repoGenerator: Generator = {
    custom: async (_, executeCommand, context) => {
        const { stdout } = await executeCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${context.environmentVariables["HOME"]}/.projj/cache.json`],
        });
        const cache = JSON.parse(stdout);
        return Object.keys(cache).map((key) => ({
            name: key.split("/").pop(),
            description: cache[key].repo,
        }));
    },
};
const hookGenerator: Generator = {
    custom: async (_, executeCommand, context) => {
        const { stdout } = await executeCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${context.environmentVariables["HOME"]}/.projj/config.json`],
        });
        const cache = JSON.parse(stdout);
        const hooks = cache.hooks;
        return Object.keys(hooks).map((key) => ({
            name: key,
            description: hooks[key],
        }));
    },
};
const completionSpec: CommandSpec = {
    name: "projj",
    description: "Manage repository easily",
    subcommands: [
        {
            name: "completion",
            description: "Generate completion script"
        },
        {
            name: "add",
            description: "Add repository",
            args: {
                name: "repository url"
            }
        },
        {
            name: "find",
            description: "Find repository",
            args: {
                name: "repository name"
            }
        },
        {
            name: "import",
            description: "Import repositories from existing directory",
            args: {
                name: "directory"
            }
        },
        {
            name: "init",
            description: "Initialize configuration"
        },
        {
            name: "remove",
            description: "Remove repository",
            args: {
                name: "repository name"
            }
        },
        {
            name: "run",
            description: "Run hook in current directory",
            args: {
                name: "hook name"
            }
        },
        {
            name: "runall",
            description: "Run hook in every repository",
            args: {
                name: "hook name"
            }
        },
        {
            name: "sync",
            description: "Sync data from directory",
            args: {
                name: "directory"
            }
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for projj"
        },
        {
            name: ["--version", "-v"],
            description: "Show version number"
        }
    ]
};
export default completionSpec;
