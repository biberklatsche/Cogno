import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "ansible-config",
    description: "View ansible configuration",
    subcommands: [
        {
            name: "list",
            description: "List and output available configs",
            options: [
                {
                    name: ["--help", "-h"],
                    description: "Show help and exit"
                },
                {
                    name: "--verbose",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)"
                },
                {
                    name: "-v",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)",
                    isRepeatable: true
                },
                {
                    name: ["--config", "-c"],
                    description: "Path to configuration file, defaults to first file found in precedence",
                    args: {
                        name: "CONFIG_FILE",
                        description: "Path to configuration file"
                    }
                },
                {
                    name: ["--type", "-t"],
                    description: "Filter down to a specific plugin type",
                    args: {
                        name: "TYPE",
                        description: "Plugin type"
                    }
                }
            ],
            args: {
                name: "args",
                description: "Specific plugin to target, requires type of plugin to be set"
            }
        },
        {
            name: "dump",
            description: "Shows the current settings, merges ansible.cfg if specified",
            options: [
                {
                    name: ["--help", "-h"],
                    description: "Show help and exit"
                },
                {
                    name: "--verbose",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)"
                },
                {
                    name: "-v",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)",
                    isRepeatable: true
                },
                {
                    name: ["--only-changed", "--changed-only"],
                    description: "Only show configurations that have changed from the default"
                },
                {
                    name: ["--config", "-c"],
                    description: "Path to configuration file, defaults to first file found in precedence",
                    args: {
                        name: "CONFIG_FILE",
                        description: "Path to configuration file"
                    }
                },
                {
                    name: ["--type", "-t"],
                    description: "Filter down to a specific plugin type",
                    args: {
                        name: "TYPE",
                        description: "Plugin type"
                    }
                }
            ],
            args: {
                name: "args",
                description: "Specific plugin to target, requires type of plugin to be set"
            }
        },
        {
            name: "view",
            description: "Displays the current config file",
            options: [
                {
                    name: ["--help", "-h"],
                    description: "Show help and exit"
                },
                {
                    name: "--verbose",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)"
                },
                {
                    name: "-v",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)",
                    isRepeatable: true
                },
                {
                    name: ["--config", "-c"],
                    description: "Path to configuration file, defaults to first file found in precedence",
                    args: {
                        name: "CONFIG_FILE",
                        description: "Path to configuration file"
                    }
                },
                {
                    name: ["--type", "-t"],
                    description: "Filter down to a specific plugin type",
                    args: {
                        name: "TYPE",
                        description: "Plugin type"
                    }
                }
            ],
            args: {
                name: "args",
                description: "Specific plugin to target, requires type of plugin to be set"
            }
        },
        {
            name: "init",
            description: "Initializes a new config file (to stdout)",
            options: [
                {
                    name: ["--help", "-h"],
                    description: "Show help and exit"
                },
                {
                    name: "--verbose",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)"
                },
                {
                    name: "-v",
                    description: "Verbose mode (-vvv for more, -vvvv to enable connection debugging)",
                    isRepeatable: true
                },
                {
                    name: "--disabled",
                    description: "Prefixes all entries with a comment character to disable them"
                },
                {
                    name: ["--format", "-f"],
                    description: "Output format for init",
                    args: {
                        name: "FORMAT",
                        description: "Output format"
                    }
                },
                {
                    name: ["--config", "-c"],
                    description: "Path to configuration file, defaults to first file found in precedence",
                    args: {
                        name: "CONFIG_FILE",
                        description: "Path to configuration file"
                    }
                },
                {
                    name: ["--type", "-t"],
                    description: "Filter down to a specific plugin type",
                    args: {
                        name: "TYPE",
                        description: "Plugin type"
                    }
                }
            ],
            args: {
                name: "args",
                description: "Specific plugin to target, requires type of plugin to be set"
            }
        }
    ],
    options: [
        {
            name: "--version",
            description: "Shows version number, config file location, module search path, module location, executable location and exit"
        },
        {
            name: ["--help", "-h"],
            description: "Show help and exit"
        }
    ]
};
export default completionSpec;
