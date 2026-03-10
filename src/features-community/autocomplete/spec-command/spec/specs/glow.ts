import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "glow",
    description: "Render markdown on the CLI, with pizzazz!",
    options: [
        {
            name: ["-a", "--all"],
            description: "Show system files and directories (TUI-mode only)"
        },
        {
            name: "--config",
            args: { name: "path" },
            description: "Config file"
        },
        {
            name: ["-h", "--help"],
            description: "Help for glow"
        },
        {
            name: ["-l", "--local"],
            description: "Show local files only; no network (TUI-mode only)"
        },
        {
            name: ["-p", "--pager"],
            description: "Display with pager"
        },
        {
            name: ["-s", "--style"],
            description: "Style name or JSON path (default 'auto')",
            args: {
                name: "name"
            }
        },
        {
            name: ["-v", "--version"],
            description: "Version for glow"
        },
        {
            name: ["-w", "--width"],
            args: { name: "column" },
            description: "Word-wrap at width"
        }
    ],
    subcommands: [
        {
            name: "config",
            description: "Edit the glow config file"
        },
        {
            name: "help",
            description: "Help about any command",
            args: {
                name: "command"
            }
        },
        {
            name: "stash",
            description: "Manage your stash of markdown files",
            args: {
                name: "path"
            },
            options: [
                {
                    name: ["-m", "--memo"],
                    description: "Memo/note for stashing",
                    args: { name: "note" }
                }
            ]
        }
    ]
};
export default completionSpec;
