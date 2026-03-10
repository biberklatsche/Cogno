import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "yomo",
    description: "CLI interface for YoMo",
    subcommands: [
        {
            name: "init",
            description: "Initial an example StreamFunction",
            args: {
                name: "function name",
                description: "StreamFunction name to initialize locally"
            },
            options: [
                {
                    name: "--rx",
                    description: "Generate Rx code template"
                }
            ]
        },
        {
            name: "build",
            description: "Build a StreamFunction to WebAssembly",
            args: {
                name: ".go file",
                description: "The .go file to build"
            },
            options: [
                {
                    name: "--target",
                    description: "Build to wasm or binary",
                    args: [
                        {
                            name: "wasm"
                        },
                        {
                            name: "binary"
                        }
                    ]
                },
                {
                    name: ["-m", "--modfile"],
                    description: "Custom go.mod filepath",
                    args: {
                        name: "module"
                    }
                }
            ]
        },
        {
            name: "run",
            description: "Run a wasm stream function",
            args: {
                name: ".wasm file",
                description: "The .wasm file to run"
            },
            options: [
                {
                    name: ["-z", "--zipper"],
                    description: "Zipper endpoint this StreamFunction will connect to"
                },
                {
                    name: ["-n", "--name"],
                    description: "Specify the name of this StreamFunction"
                }
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for yomo"
        }
    ]
};
export default completionSpec;
