import type { CommandSpec, Generator } from "../spec.types";
const projectsAndFoldersGenerator: Generator = {
    template: "folders",
    filterTemplateSuggestions: (paths) => {
        return paths.map((file) => {
            const isXcodeProjFolder = file.name.endsWith(".xcodeproj/");
            return {
                ...file,
                priority: isXcodeProjFolder && 76,
            };
        });
    },
};
const completionSpec: CommandSpec = {
    name: "xcodeproj",
    description: "Xcodeproj lets you create and modify Xcode projects",
    subcommands: [
        {
            description: "Dumps the build settings of all project targets for all configurations in directories named by the target in the given output directory",
            name: "config-dump",
            args: [
                {
                    name: "PROJECT"
                },
                {
                    name: "OUTPUT"
                }
            ]
        },
        {
            description: "Shows the difference between two projects",
            name: "project-diff",
            options: [
                {
                    name: "--ignore",
                    isRepeatable: true,
                    description: "A key to ignore in the comparison. Can be specified multiple times",
                    args: {
                        name: "KEY"
                    }
                }
            ],
            args: [
                {
                    name: "PROJECT1"
                },
                {
                    name: "PROJECT2"
                }
            ]
        },
        {
            description: "Shows an overview of a project in a YAML representation",
            name: "show",
            options: [
                {
                    name: "--format",
                    description: "YAML output format",
                    args: {
                        name: "FORMAT"
                    }
                }
            ],
            args: {
                name: "PROJECT"
            }
        },
        {
            description: "Sorts the given project",
            name: "sort",
            options: [
                {
                    name: "--group-option",
                    description: "The position of the groups when sorting. If no option is specified sorting will interleave groups and files",
                    args: {
                        name: "POSITION"
                    }
                }
            ],
            args: {
                name: "PROJECT"
            }
        },
        {
            description: "Shows the difference between two targets",
            name: "target-diff",
            options: [
                {
                    name: "--project",
                    description: "The Xcode project document to use",
                    args: {
                        name: "PATH"
                    }
                }
            ],
            args: [
                {
                    name: "TARGET1"
                },
                {
                    name: "TARGET2"
                }
            ]
        }
    ],
    options: [
        {
            name: "--verbose",
            description: "Show more debugging information"
        },
        {
            name: "--version",
            description: "Show the version of the tool"
        },
        {
            name: "--no-ansi",
            description: "Show output without ANSI codes"
        },
        {
            name: "--help",
            description: "Show help banner of specified command"
        }
    ]
};
export default completionSpec;
