import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "wasm-pack",
    description: "",
    subcommands: [
        {
            name: "build",
            description: "Build an npm package"
        },
        {
            name: "help",
            description: "Prints this message or the help of the given subcommand(s)",
            args: {
                name: "subcommand"
            }
        },
        {
            name: ["login", "adduser", "add-user"],
            description: "Add an npm registry user account"
        },
        {
            name: "new",
            description: "Create a new project with a template"
        },
        {
            name: "pack",
            description: "Create a tarball of the npm package (does not publish)"
        },
        {
            name: "publish",
            description: "Pack and publish a package to npm"
        },
        {
            name: "test",
            description: "Run tests for WebAssembly module"
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for wasm-pack or for the given subcommand(s)"
        },
        {
            name: ["--quiet", "-q"],
            description: "Suppress output from stdout"
        },
        {
            name: ["--version", "-V"],
            description: "Show version for wasm-pack"
        },
        {
            name: ["--verbose", "-v"],
            description: "Log verbosity is based off the number of v used"
        },
        {
            name: ["--log-level", "-l"],
            description: "The maximum level of messages that should be logged by wasm-pack",
            args: {
                name: "log-level"
            }
        }
    ]
};
export default completionSpec;
