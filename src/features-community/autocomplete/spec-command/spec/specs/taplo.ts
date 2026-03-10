import type { CommandSpec, OptionSpec } from "../spec.types";
const colorOptions: OptionSpec = {
    name: "--colors",
    args: {
        name: "COLORS"
    },
    description: "Set color values for the output"
};
const verboseOption: OptionSpec = {
    name: "--verbose",
    description: "Enable verbose logging format"
};
const logSpansOption: OptionSpec = {
    name: "--log-spans",
    description: "Enable logging spans"
};
const completionSpec: CommandSpec = {
    name: "taplo",
    description: "Tool for validation, formatting, and querying TOML documents with a jq-like fashion",
    subcommands: [
        {
            name: ["config", "cfg"],
            description: "Operations with the Taplo config file",
            options: [
                {
                    name: ["--help", "-h"],
                    description: "Print help information for config"
                },
                logSpansOption,
                verboseOption,
                colorOptions
            ],
            subcommands: [
                {
                    name: "default",
                    description: "Print the default `.taplo.toml` configuration file"
                },
                {
                    name: "help",
                    description: "Print this message or the help of the given subcommand(s)"
                },
                {
                    name: "schema",
                    description: "Print the JSON schema of the `.taplo.toml` configuration file"
                }
            ]
        },
        {
            name: ["format", "fmt"],
            description: "Format TOML documents",
            args: {
                name: "FILES ...",
                description: "Paths or glob patterns to TOML documents"
            },
            options: [
                {
                    name: ["--config", "-c"],
                    description: "Path to the Taplo configuration file",
                    args: {
                        name: "CONFIG"
                    }
                },
                {
                    name: "--cache-path",
                    description: "Set a cache path",
                    args: {
                        name: "CACHE_PATH"
                    }
                },
                {
                    name: "--check",
                    description: "Report any files that are not correctly formatted",
                    args: {
                        name: "CACHE_PATH"
                    }
                },
                colorOptions,
                {
                    name: "--diff",
                    description: "Print the differences in patch formatting to `stdout`"
                },
                {
                    name: ["f", "--force"],
                    description: "Force formatting of files",
                    args: {
                        name: "FILES ..."
                    }
                },
                {
                    name: ["--help", "-h"],
                    description: "Print help information for format"
                },
                logSpansOption,
                {
                    name: "--no-auto-config",
                    description: "Do not search for a configuration file"
                },
                {
                    name: ["--option", "-o"],
                    description: "A formatter option given as a 'key=value', can be set multiple times",
                    args: {
                        name: "OPTIONS"
                    }
                },
                {
                    name: "--stdin-filepath",
                    description: "A path to the file that the taplo will treat like stdin",
                    args: {
                        name: "STDIN_FILEPATH"
                    }
                },
                verboseOption
            ]
        },
        {
            name: "get",
            description: "Extract a value from the given TOML document",
            options: [
                {
                    name: ["--file-path", "-f"],
                    description: "Path to the TOML document",
                    args: {
                        name: "FILE_PATH"
                    }
                },
                colorOptions,
                {
                    name: ["--help", "-h"],
                    description: "Print help information for get"
                },
                logSpansOption,
                {
                    name: ["-o", "--output-format"],
                    description: "The format specifying how the output is printed",
                    args: {
                        name: "OUTPUT_FORMAT"
                    }
                },
                {
                    name: ["--strip-newline", "-s"],
                    description: "Strip the trailing newline from the output"
                },
                verboseOption
            ]
        },
        {
            name: "help",
            description: "Print help information for taplo"
        },
        {
            name: ["lint", "check", "validate"],
            description: "Lint a TOML documents",
            args: {
                name: "FILES ..."
            },
            options: [
                {
                    name: ["--config", "-c"],
                    description: "Path to the Taplo configuration file",
                    args: {
                        name: "CONFIG"
                    }
                },
                {
                    name: "--cache-path",
                    description: "Set a cache path",
                    args: {
                        name: "CACHE_PATH"
                    }
                },
                colorOptions,
                {
                    name: "--default-schema-catalogs",
                    description: "Use the default online catalogs for schemas"
                },
                {
                    name: ["--help", "-h"],
                    description: "Print help information for lint"
                },
                logSpansOption,
                {
                    name: "--no-schema",
                    description: "Disable all schema validation"
                },
                {
                    name: "--schema",
                    description: "URL to the schema to be used for validation",
                    args: {
                        name: "SCHEMA"
                    }
                },
                {
                    name: "--schema-catalog",
                    description: "URL to the schema catalog to be used for validation",
                    isRepeatable: true,
                    args: {
                        name: "SCHEMA_CATALOG"
                    }
                },
                verboseOption
            ]
        },
        {
            name: "lsp",
            description: "Language server operations",
            subcommands: [
                {
                    name: "help",
                    description: "Print help information for lsp"
                },
                {
                    name: "stdio",
                    description: "Run the language server over the standard input and output"
                },
                {
                    name: "tcp",
                    description: "Run the language server and listen on a TCP address"
                }
            ],
            options: [
                colorOptions,
                {
                    name: ["--help", "-h"],
                    description: "Print help information for lsp"
                },
                logSpansOption,
                verboseOption
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Print help information for taplo"
        },
        {
            name: ["--version", "-V"],
            description: "Print version information for taplo"
        },
        verboseOption,
        {
            name: "--colors"
        },
        logSpansOption
    ]
};
export default completionSpec;
