import type { ArgSpec, CommandSpec, OptionSpec } from "../../spec.types";
const applyOptions: OptionSpec[] = [
    {
        name: ["--path", "-p"],
        description: "Path to a sub-directory in which to look for a preset",
        args: {
            name: "path"
        }
    },
    {
        name: ["--tag", "-t"],
        description: "Branch or tag to use if the preset is a repository",
        args: {
            name: "tag"
        }
    },
    {
        name: "--no-ssh",
        description: "Do not use SSH when cloning repositories"
    },
    {
        name: "--no-cache",
        description: "Do not use the cached repository if it exists"
    }
];
const applyArguments: ArgSpec[] = [
    {
        name: "resolvable",
        description: "Repository identifier or path to the preset"
    },
    {
        name: "target-directory",
        description: "Directory in which to apply the preset"
    }
];
const completionSpec: CommandSpec = {
    name: "preset",
    description: "Elegant, ecosystem-agnostic scaffolding tool",
    subcommands: [
        {
            name: "apply",
            description: "Apply a preset",
            options: applyOptions,
            args: applyArguments
        },
        {
            name: "init",
            description: "Create a new preset",
            args: {
                name: "target-directory",
                description: "Directory in which to apply the preset"
            }
        }
    ],
    options: [
        ...applyOptions,
        {
            name: ["--help", "-h"],
            description: "Show help for preset"
        },
        {
            name: ["--version", "-v"],
            description: "Show the version number"
        },
        {
            name: "--no-interaction",
            description: "Disable interactions"
        },
        {
            name: "--debug",
            description: "Display debug information instead of standard output"
        },
        {
            name: "--silent",
            description: "Do not print anything"
        }
    ]
};
export default completionSpec;
