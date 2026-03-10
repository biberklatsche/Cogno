import type { CommandSpec, OptionSpec, Suggestion } from "../spec.types";
const subcommandsList: Suggestion[] = [
    {
        name: "add",
        type: "subcommand",
    },
    {
        name: "auth",
        type: "subcommand",
    },
    {
        name: ["blame", "praise", "annotate", "ann"],
        type: "subcommand",
    },
    {
        name: "cat",
        type: "subcommand",
    },
    {
        name: ["changelist", "cl"],
        type: "subcommand",
    },
    {
        name: ["checkout", "co"],
        type: "subcommand",
    },
    {
        name: "cleanup",
        type: "subcommand",
    },
    {
        name: ["commit", "ci"],
        type: "subcommand",
    },
    {
        name: ["copy", "cp"],
        type: "subcommand",
    },
    {
        name: ["delete", "del", "remove", "rm"],
        type: "subcommand",
    },
    {
        name: ["diff", "di"],
        type: "subcommand",
    },
    {
        name: "export",
        type: "subcommand",
    },
    {
        name: ["help", "?", "h"],
        type: "subcommand",
    },
    {
        name: "import",
        type: "subcommand",
    },
    {
        name: "info",
        type: "subcommand",
    },
    {
        name: ["list", "ls"],
        type: "subcommand",
    },
    {
        name: "lock",
        type: "subcommand",
    },
    {
        name: "log",
        type: "subcommand",
    },
    {
        name: "merge",
        type: "subcommand",
    },
    {
        name: "mergeinfo",
        type: "subcommand",
    },
    {
        name: "mkdir",
        type: "subcommand",
    },
    {
        name: ["move", "mv", "rename", "ren"],
        type: "subcommand",
    },
    {
        name: "patch",
        type: "subcommand",
    },
    {
        name: ["propdel", "pdel", "pd"],
        type: "subcommand",
    },
    {
        name: ["propedit", "pedit", "pe"],
        type: "subcommand",
    },
    {
        name: ["propget", "pget", "pg"],
        type: "subcommand",
    },
    {
        name: ["proplist", "plist", "pl"],
        type: "subcommand",
    },
    {
        name: ["propset", "pset", "ps"],
        type: "subcommand",
    },
    {
        name: "relocate",
        type: "subcommand",
    },
    {
        name: "resolve",
        type: "subcommand",
    },
    {
        name: "resolved",
        type: "subcommand",
    },
    {
        name: "revert",
        type: "subcommand",
    },
    {
        name: ["status", "stat", "st"],
        type: "subcommand",
    },
    {
        name: ["switch", "sw"],
        type: "subcommand",
    },
    {
        name: "unlock",
        type: "subcommand",
    },
    {
        name: ["update", "up"],
        type: "subcommand",
    },
    {
        name: "upgrade",
        type: "subcommand",
    }
];
const globalOptions: OptionSpec[] = [
    {
        name: "--username",
        description: "Specify a username ARG",
        args: {
            name: "username"
        }
    },
    {
        name: "--password",
        description: "Specify a password ARG",
        args: {
            name: "password"
        }
    },
    {
        name: "--password-from-stdin",
        description: "Read password from stdin"
    },
    {
        name: "--no-auth-cache",
        description: "Do not cache authentication tokens"
    },
    {
        name: "--non-interactive",
        description: "Do no interactive prompting (default is to prompt only if standard input is a terminal device)"
    },
    {
        name: "--force-interactive",
        description: "Do interactive prompting even if standard input is not a terminal device"
    },
    {
        name: "--trust-server-cert",
        description: "Specify a password ARG",
        args: {
            name: "message"
        }
    },
    {
        name: "--trust-server-cert-failures",
        description: "Specify a password ARG",
        args: {
            name: "message"
        }
    },
    {
        name: "--config-dir",
        description: "Read user configuration files from directory ARG",
        args: {
            name: "message"
        }
    },
    {
        name: "--config-option",
        description: "Specify a password ARG",
        args: {
            name: "message"
        }
    }
];
const completionSpec: CommandSpec = {
    name: "svn",
    description: "The first content tracker",
    subcommands: [
        {
            name: ["help", "h"],
            description: "Show help for svn",
            args: {
                name: "subcommand",
                description: "Help about specific subcommand"
            }
        },
        {
            name: ["status", "st"],
            description: "Show the working tree status"
        },
        {
            name: "info",
            description: "Show information about a local or remote item"
        },
        {
            name: ["checkout", "co"],
            description: "Check out a working copy from a repository",
            args: {
                name: "repository",
                description: "The repository you want to checkout"
            }
        },
        {
            name: ["commit", "ci"],
            description: "Commit to a repository",
            options: [
                {
                    name: ["-m", "--message"],
                    description: "Use the given message as the commit message",
                    args: {
                        name: "message"
                    }
                },
                ...globalOptions
            ]
        }
    ],
    options: [
        {
            name: "--version",
            description: "Show help for svn"
        },
        {
            name: "--verbose",
            description: "Show help for svn"
        },
        {
            name: "--quiet",
            description: "Show help for svn"
        }
    ]
};
export default completionSpec;
