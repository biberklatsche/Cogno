import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "sapphire",
    description: "CLI for the Sapphire Framework",
    subcommands: [
        {
            name: ["new", "n"],
            description: "Creates a new Sapphire project",
            args: {
                name: "name",
                description: "Project name"
            },
            options: [
                {
                    name: ["-v", "--verbose"],
                    description: "Enable verbose logging"
                }
            ]
        },
        {
            name: ["generate", "g"],
            description: "Generates a component/piece",
            args: [
                {
                    name: "component",
                    description: "Component/piece name"
                },
                {
                    name: "name",
                    description: "File name"
                }
            ]
        },
        {
            name: ["init", "i"],
            description: "Creates a config file on an existing Sapphire project"
        },
        {
            name: "help",
            description: "Display help for command",
            args: {
                name: "command",
                description: "Command to display help for"
            }
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for sapphire"
        },
        {
            name: ["--version", "-V"],
            description: "Output the version number"
        }
    ]
};
export default completionSpec;
