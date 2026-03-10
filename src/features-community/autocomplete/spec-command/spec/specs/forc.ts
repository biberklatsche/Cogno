import type { CommandSpec } from "../spec.types";
const completion: CommandSpec = {
    name: "forc",
    description: "Fuel Orchestrator",
    subcommands: [
        {
            name: "addr2line",
            description: "Show location and context of an opcode address in its source file",
            options: [
                {
                    name: "-S",
                    description: "Where to search for the project root"
                },
                {
                    name: "-g",
                    description: "Source file mapping in JSON format"
                },
                {
                    name: "-c",
                    description: "How many lines of context to show"
                },
                {
                    name: "-i",
                    description: "Opcode index"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "build",
            description: "Compile the current or target project",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--release"
                },
                {
                    name: "--error-on-warnings"
                },
                {
                    name: "--build-target"
                },
                {
                    name: "--tests"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "check",
            description: "Check the current or target project and all of its dependencies for errors",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "build-target"
                },
                {
                    name: "--offline-mode"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--disable-tests"
                },
                {
                    name: "--ipfs-node"
                }
            ]
        },
        {
            name: "clean",
            description: "Removes the default forc compiler output artifact directory, i.e. `<project-name>/out`",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "completions",
            description: "Generate tab-completion scripts for your shell",
            options: [
                {
                    name: "-T",
                    description: "Specify shell to enable tab-completion for",
                    args: {
                        name: "--target"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "new",
            description: "Create a new Forc project at `<path>`",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--contract"
                },
                {
                    name: "--script"
                },
                {
                    name: "--predicate"
                },
                {
                    name: "--library"
                },
                {
                    name: "--workspace"
                },
                {
                    name: "--name"
                },
                {
                    name: "path"
                }
            ]
        },
        {
            name: "init",
            description: "Create a new Forc project in an existing directory",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--path"
                },
                {
                    name: "--contract"
                },
                {
                    name: "--script"
                },
                {
                    name: "--predicate"
                },
                {
                    name: "--library"
                },
                {
                    name: "--workspace"
                },
                {
                    name: "--name"
                }
            ]
        },
        {
            name: "parse-bytecode",
            description: "Parse bytecode file into a debug format",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "file-path"
                }
            ]
        },
        {
            name: "test",
            description: "Run the Sway unit tests for the current project",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: "-r",
                    description: "Pretty-print the logs emiited from tests"
                },
                {
                    name: "-l",
                    description: "Print `Log` and `LogData` receipts for tests"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--release"
                },
                {
                    name: "--error-on-warnings"
                },
                {
                    name: "--build-target"
                },
                {
                    name: "filter"
                },
                {
                    name: "--filter-exact"
                },
                {
                    name: "--test-threads"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "update",
            description: "Update dependencies in the Forc dependencies directory",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-d",
                    description: "Dependency to be updated. If not set, all dependencies will be updated"
                },
                {
                    name: "-c",
                    description: "Checks if the dependencies have newer versions. Won't actually perform the update, will output which ones are up-to-date and outdated"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--ipfs-node"
                }
            ]
        },
        {
            name: "plugins",
            description: "List all forc plugins",
            options: [
                {
                    name: "-p",
                    description: "Prints the absolute path to each discovered plugin"
                },
                {
                    name: "-d",
                    description: "Prints the long description associated with each listed plugin"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "template",
            description: "Create a new Forc project from a git template",
            options: [
                {
                    name: "-u",
                    description: "The template url, should be a git repo"
                },
                {
                    name: "-t",
                    description: "The name of the template that needs to be fetched and used from git repo provided"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "project-name"
                }
            ]
        },
        {
            name: "contract-id",
            description: "Determine contract-id for a contract. For workspaces outputs all contract ids in the workspace",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--release"
                },
                {
                    name: "--error-on-warnings"
                },
                {
                    name: "--salt"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "predicate-root",
            description: "Determine predicate-root for a predicate. For workspaces outputs all predicate roots in the workspace",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--release"
                },
                {
                    name: "--error-on-warnings"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "debug",
            options: [
                {
                    name: "-s",
                    description: "Start the DAP server"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "api-url"
                }
            ]
        },
        {
            name: "run",
            description: "Run script project. Crafts a script transaction then sends it to a running node",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: "-d",
                    description: "Hex string of data to input to script"
                },
                {
                    name: "-r",
                    description: "Pretty-print the outputs from the node"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--price"
                },
                {
                    name: "--script-gas-limit"
                },
                {
                    name: "--maturity"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--release"
                },
                {
                    name: "--error-on-warnings"
                },
                {
                    name: "--node-url"
                },
                {
                    name: "--target"
                },
                {
                    name: "--testnet"
                },
                {
                    name: "--dry-run"
                },
                {
                    name: "--contract"
                },
                {
                    name: "--simulate"
                },
                {
                    name: "--default-signer"
                },
                {
                    name: "--unsigned"
                },
                {
                    name: "signing-key"
                },
                {
                    name: "--manual-signing"
                },
                {
                    name: "--args"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "crypto",
            description: "Forc plugin for hashing arbitrary data",
            subcommands: [
                {
                    name: "keccak256",
                    description: "Hashes the argument or file with this algorithm",
                    options: [
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        },
                        {
                            name: "content-or-filepath"
                        }
                    ]
                },
                {
                    name: "sha256",
                    description: "Hashes the argument or file with this algorithm",
                    options: [
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        },
                        {
                            name: "content-or-filepath"
                        }
                    ]
                },
                {
                    name: "address",
                    description: "Converts an address to another format",
                    options: [
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        },
                        {
                            name: "address"
                        }
                    ]
                },
                {
                    name: "get-public-key",
                    description: "Get the public key from a message and its signature",
                    options: [
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        },
                        {
                            name: "signature"
                        },
                        {
                            name: "message"
                        }
                    ]
                },
                {
                    name: "new-key",
                    description: "Creates a new key for use with fuel-core",
                    options: [
                        {
                            name: "-k",
                            description: "Key type to generate. It can either be `block-production` or `peering`",
                            args: {
                                name: "--key-type"
                            }
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        }
                    ]
                },
                {
                    name: "parse-secret",
                    description: "Parses a private key to view the associated public key",
                    options: [
                        {
                            name: "-k",
                            description: "Key type to generate. It can either be `block-production` or `peering`",
                            args: {
                                name: "--key-type"
                            }
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        }
                    ],
                    args: [
                        {
                            name: "--help"
                        },
                        {
                            name: "--version"
                        },
                        {
                            name: "secret"
                        }
                    ]
                },
                {
                    name: "help",
                    description: "Print this message or the help of the given subcommand(s)",
                    args: {
                        name: "subcommand"
                    }
                }
            ],
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "doc",
            description: "Forc plugin for building a Sway package's documentation",
            options: [
                {
                    name: "-s",
                    description: "Silent mode. Don't output any warnings or errors to the command line"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--manifest-path"
                },
                {
                    name: "--document-private-items"
                },
                {
                    name: "--open"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--no-deps"
                },
                {
                    name: "--ipfs-node"
                }
            ]
        },
        {
            name: "fmt",
            description: "Forc plugin for running the Sway code formatter",
            options: [
                {
                    name: "-c",
                    description: "Run in 'check' mode"
                },
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-f",
                    description: "Formats a single .sw file with the default settings. If not specified, current working directory will be formatted using a Forc.toml configuration"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                }
            ]
        },
        {
            name: "submit",
            description: "A `forc` plugin for interacting with a Fuel node",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--node-url"
                },
                {
                    name: "--target"
                },
                {
                    name: "--testnet"
                },
                {
                    name: "--await"
                },
                {
                    name: "--json"
                },
                {
                    name: "tx-path"
                }
            ]
        },
        {
            name: "deploy",
            description: "Build output file options",
            options: [
                {
                    name: "-p",
                    description: "Path to the project, if not specified, current working directory will be used"
                },
                {
                    name: "-t",
                    description: "Terse mode. Limited warning and error output"
                },
                {
                    name: "-o",
                    description: "If set, outputs a binary file representing the script bytes"
                },
                {
                    name: "-g",
                    description: "If set, outputs source file mapping in JSON format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: [
                {
                    name: "--help"
                },
                {
                    name: "--version"
                },
                {
                    name: "--offline"
                },
                {
                    name: "--output-directory"
                },
                {
                    name: "--locked"
                },
                {
                    name: "--json-abi-with-callpaths"
                },
                {
                    name: "--ipfs-node"
                },
                {
                    name: "--json-abi"
                },
                {
                    name: "--json-storage-slots"
                },
                {
                    name: "--ast"
                },
                {
                    name: "--dca-graph"
                },
                {
                    name: "--dca-graph-url-format"
                },
                {
                    name: "--finalized-asm"
                },
                {
                    name: "--intermediate-asm"
                },
                {
                    name: "--ir"
                },
                {
                    name: "--time-phases"
                },
                {
                    name: "--reverse-order"
                },
                {
                    name: "--metrics-outfile"
                },
                {
                    name: "--price"
                },
                {
                    name: "--script-gas-limit"
                },
                {
                    name: "--maturity"
                },
                {
                    name: "--node-url"
                },
                {
                    name: "--target"
                },
                {
                    name: "--testnet"
                },
                {
                    name: "--salt"
                },
                {
                    name: "--default-salt"
                },
                {
                    name: "--build-profile"
                },
                {
                    name: "--default-signer"
                },
                {
                    name: "--unsigned"
                },
                {
                    name: "signing-key"
                },
                {
                    name: "--manual-signing"
                },
                {
                    name: "--JSON_FILE_PATH"
                },
                {
                    name: "--experimental-new-encoding"
                }
            ]
        },
        {
            name: "help",
            description: "Print this message or the help of the given subcommand(s)",
            args: {
                name: "subcommand"
            }
        }
    ],
    options: [
        {
            name: ["-h", "--help"],
            description: "Print help information"
        },
        {
            name: "-v",
            description: "Use verbose output"
        },
        {
            name: "-s",
            description: "Silence all output"
        },
        {
            name: "-L",
            description: "Set the log level"
        }
    ]
};
export default completion;
