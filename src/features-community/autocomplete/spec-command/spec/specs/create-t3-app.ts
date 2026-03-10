import type { ArgSpec, CommandSpec } from "../spec.types";
const dirArgument: ArgSpec = {
    name: "dir",
    description: "The name of the application, as well as the name of the directory to create"
};
const completionSpec: CommandSpec = {
    name: "create-t3-app",
    description: "A CLI for creating web applications with the t3 stack",
    options: [
        {
            name: "--noGit",
            description: "Explicitly tell the CLI to not initialize a new git repo in the project (default: false)"
        },
        {
            name: "--noInstall",
            description: "Explicitly tell the CLI to not run the package manager's install command (default: false)"
        },
        {
            name: ["-y", "--default"],
            description: "Bypass the CLI and use all default options to bootstrap a new t3-app (default: false)"
        },
        {
            name: "--CI",
            description: "Boolean value if we're running in CI (default: false)"
        },
        {
            name: "--tailwind",
            description: "Experimental: Boolean value if we should install Tailwind CSS. Must be used in conjunction with `--CI`",
            args: {
                name: "boolean"
            }
        },
        {
            name: "--nextAuth",
            description: "Experimental: Boolean value if we should install NextAuth.js. Must be used in conjunction with `--CI`",
            args: {
                name: "boolean"
            }
        },
        {
            name: "--prisma",
            description: "Experimental: Boolean value if we should install Prisma. Must be used in conjunction with `--CI`",
            args: {
                name: "boolean"
            }
        },
        {
            name: "--trpc",
            description: "Experimental: Boolean value if we should install tRPC. Must be used in conjunction with `--CI`",
            args: {
                name: "boolean"
            }
        },
        {
            name: ["-i", "--import-alias"],
            description: "Explicitly tell the CLI to use a custom import alias",
            args: {
                name: "alias"
            }
        },
        {
            name: ["-v", "--version"],
            description: "Display the version number"
        },
        {
            name: ["--help", "-h"],
            description: "Display help for command"
        }
    ]
};
export default completionSpec;
