import node from "./node";
import type { ArgSpec, CommandSpec } from "../spec.types";
const versionArg: ArgSpec = {
    name: "version"
};
const optionalVersionArg: ArgSpec = {
    ...versionArg
};
const variadicVersionArg: ArgSpec = {
    ...versionArg
};
const completionSpec: CommandSpec = {
    name: "n",
    description: "Node version management",
    subcommands: [
        {
            name: ["i", "install"],
            description: "Install a Node.js version",
            args: versionArg
        },
        {
            name: ["rm", "–"],
            description: "Remove a Node.js version",
            args: variadicVersionArg
        },
        {
            name: "prune",
            description: "Remove all cached Node.js versions except the installed version"
        },
        {
            name: "doctor",
            description: "Display diagnostics to help resolve problems"
        },
        {
            name: "uninstall",
            description: "Remove the installed Node.js"
        },
        {
            name: ["ls", "list"],
            description: "Output downloaded versions"
        },
        {
            name: ["lsr", "ls-remote", "list-remote"],
            description: "Output matching versions available for download",
            args: versionArg,
            options: [
                {
                    name: "--all",
                    description: "Ls-remote displays all matches instead of last 20"
                }
            ]
        },
        {
            name: ["which", "bin"],
            description: "Output path for downloaded node version",
            args: versionArg
        },
        {
            name: ["run", "use", "as"],
            description: "Execute downloaded Node.js version with args",
            args: [versionArg, ...[node.args].flat()],
            subcommands: node.subcommands,
            options: node.options
        },
        {
            name: "exec",
            description: "Execute command with modified PATH, so downloaded node version and npm first",
            args: [
                versionArg,
                {
                    name: "cmd"
                },
                {
                    name: "args"
                }
            ]
        }
    ],
    options: [
        {
            name: ["-V", "--version"],
            description: "Output version of n"
        },
        {
            name: ["-h", "--help"],
            description: "Display help information"
        },
        {
            name: ["-p", "--preserve"],
            description: "Preserve npm and npx during install of Node.js"
        },
        {
            name: "--no-preserve",
            description: "Do not preserve npm and npx during install of Node.js"
        },
        {
            name: ["-q", "--quiet"],
            description: 'Disable curl output. Disable log messages processing "auto" and "engine" labels'
        },
        {
            name: ["-d", "--download"],
            description: "Download only"
        },
        {
            name: ["-a", "--arch"],
            description: "Override system architecture",
            args: {
                name: "Architecture"
            }
        },
        {
            name: "--insecure",
            description: "Turn off certificate checking for https requests (may be needed from behind a proxy server)"
        },
        {
            name: "--use-xz",
            description: "Override automatic detection of xz support and enable use of xz compressed node downloads"
        },
        {
            name: "--no-use-xz",
            description: "Override automatic detection of xz support and disable use of xz compressed node downloads"
        }
    ]
};
export default completionSpec;
