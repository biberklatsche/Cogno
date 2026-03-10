import { filepaths } from "@fig/autocomplete-generators";
import type { ArgSpec, CommandSpec, SubcommandSpec } from "../spec.types";
const shortcut: ArgSpec = {};
const subcommands: SubcommandSpec[] = [
    {
        name: "run",
        description: "Run a shortcut",
        args: {
            name: "shortcut-name",
            description: "The name of the shortcut to run"
        },
        options: [
            {
                name: ["-i", "--input-path"],
                args: {
                    name: "input-path"
                },
                description: "The input to provide to the shortcut"
            },
            {
                name: ["-o", "--output-path"],
                args: {
                    name: "output-path"
                },
                description: "Where to write the shortcut output, if applicable"
            },
            {
                name: "--output-type",
                args: {
                    name: "output-type"
                },
                description: "What type to output data in, in Universal Type Identifier format"
            }
        ]
    },
    {
        name: "list",
        description: "List your shortcuts",
        options: [
            {
                name: ["--folder-name", "-f"],
                description: "The name of the folder to list",
                args: {
                    name: "folder-name"
                }
            },
            {
                name: "--folders",
                description: "List folders instead of shortcuts"
            }
        ]
    },
    {
        name: "view",
        description: "View a shortcut in Shortcuts",
        args: {
            name: "shortcut-name",
            description: "The name of the shortcut to view"
        }
    },
    {
        name: "sign",
        description: "Sign a shortcut file",
        options: [
            {
                name: ["--input", "-i"],
                description: "The shortcut file to sign",
                args: {
                    name: "input"
                }
            },
            {
                name: ["--output", "-o"],
                description: "Output path for the signed shortcut file",
                args: {
                    name: "output"
                }
            },
            {
                name: ["--mode", "-m"],
                description: "The signing mode. (default: people-who-know-me)",
                args: {
                    name: "mode"
                }
            }
        ]
    }
];
const completionSpec: CommandSpec = {
    name: "shortcuts",
    description: "Command-line utility for running shortcuts",
    subcommands: [
        ...subcommands,
        {
            name: "help",
            description: "Show help information",
            subcommands: subcommands.map(({ name, description, icon }) => ({
                name,
                description,
                icon,
            }))
        }
    ]
};
export default completionSpec;
