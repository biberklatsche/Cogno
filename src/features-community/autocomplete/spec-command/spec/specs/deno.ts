import type { CommandSpec } from "../spec.types";
import { generateDocs, generateInstalledDenoScripts, generateLintRules, generateTasks, generateUrlScript, generateVersions, } from "./deno/generators";
const completion: CommandSpec = {
    name: "deno",
    description: "A modern JavaScript and TypeScript runtime",
    subcommands: [
        {
            name: "bench",
            description: "Run benchmarks",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--allow-read",
                    description: "Allow file system read access",
                    args: {
                        name: "allow-read"
                    }
                },
                {
                    name: "--allow-write",
                    description: "Allow file system write access",
                    args: {
                        name: "allow-write"
                    }
                },
                {
                    name: "--allow-net",
                    description: "Allow network access",
                    args: {
                        name: "allow-net"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: "--allow-env",
                    description: "Allow environment access",
                    args: {
                        name: "allow-env"
                    }
                },
                {
                    name: "--allow-run",
                    description: "Allow running subprocesses",
                    args: {
                        name: "allow-run"
                    }
                },
                {
                    name: "--allow-ffi",
                    description: "Allow loading dynamic libraries",
                    args: {
                        name: "allow-ffi"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: "--ignore",
                    description: "Ignore files",
                    args: {
                        name: "ignore"
                    }
                },
                {
                    name: "--filter",
                    description: "Run benchmarks with this string or pattern in the bench name",
                    args: {
                        name: "filter"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--allow-hrtime",
                    description: "Allow high resolution time measurement"
                },
                {
                    name: ["-A", "--allow-all"],
                    description: "Allow all permissions"
                },
                {
                    name: "--prompt",
                    description: "Deprecated: Fallback to prompt if required permission wasn't passed"
                },
                {
                    name: "--no-prompt",
                    description: "Always throw if required permission wasn't passed"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: [
                {
                    name: "files"
                },
                {
                    name: "script_arg"
                }
            ]
        },
        {
            name: "bundle",
            description: "Bundle module and dependencies into single file",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: [
                {
                    name: "source_file"
                },
                {
                    name: "out_file"
                }
            ]
        },
        {
            name: "cache",
            description: "Cache the dependencies",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "file"
            }
        },
        {
            name: "check",
            description: "Type-check the dependencies",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--remote",
                    description: "Type-check all modules, including remote"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "file"
            }
        },
        {
            name: "compile",
            description: "UNSTABLE: Compile the script into a self contained executable",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--allow-read",
                    description: "Allow file system read access",
                    args: {
                        name: "allow-read"
                    }
                },
                {
                    name: "--allow-write",
                    description: "Allow file system write access",
                    args: {
                        name: "allow-write"
                    }
                },
                {
                    name: "--allow-net",
                    description: "Allow network access",
                    args: {
                        name: "allow-net"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: "--allow-env",
                    description: "Allow environment access",
                    args: {
                        name: "allow-env"
                    }
                },
                {
                    name: "--allow-run",
                    description: "Allow running subprocesses",
                    args: {
                        name: "allow-run"
                    }
                },
                {
                    name: "--allow-ffi",
                    description: "Allow loading dynamic libraries",
                    args: {
                        name: "allow-ffi"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: ["-o", "--output"],
                    description: "Output file (defaults to $PWD/<inferred-name>)",
                    args: {
                        name: "output"
                    }
                },
                {
                    name: "--target",
                    description: "Target OS architecture",
                    args: {
                        name: "target"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--allow-hrtime",
                    description: "Allow high resolution time measurement"
                },
                {
                    name: ["-A", "--allow-all"],
                    description: "Allow all permissions"
                },
                {
                    name: "--prompt",
                    description: "Deprecated: Fallback to prompt if required permission wasn't passed"
                },
                {
                    name: "--no-prompt",
                    description: "Always throw if required permission wasn't passed"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "script_arg"
            }
        },
        {
            name: "completions",
            description: "Generate shell completions",
            options: [
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "shell"
            }
        },
        {
            name: "coverage",
            description: "Print coverage reports",
            options: [
                {
                    name: "--ignore",
                    description: "Ignore coverage files",
                    args: {
                        name: "ignore"
                    }
                },
                {
                    name: "--include",
                    description: "Include source files in the report",
                    isRepeatable: true,
                    args: {
                        name: "include"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude source files from the report",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: "--output",
                    description: "Output file (defaults to stdout) for lcov",
                    args: {
                        name: "output"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--lcov",
                    description: "Output coverage report in lcov format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "files"
            }
        },
        {
            name: "doc",
            description: "Show documentation for a module",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--json",
                    description: "Output documentation in JSON format"
                },
                {
                    name: "--private",
                    description: "Output private documentation"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: [
                {
                    name: "source_file"
                },
                {
                    name: "filter"
                }
            ]
        },
        {
            name: "eval",
            description: "Eval script",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--inspect",
                    description: "Activate inspector on host:port (default: 127.0.0.1:9229)",
                    args: {
                        name: "inspect"
                    }
                },
                {
                    name: "--inspect-brk",
                    description: "Activate inspector on host:port and break at start of user script",
                    args: {
                        name: "inspect-brk"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: "--ext",
                    description: "Set standard input (stdin) content type",
                    args: {
                        name: "ext"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: ["-T", "--ts"],
                    description: "Treat eval input as TypeScript"
                },
                {
                    name: ["-p", "--print"],
                    description: "Print result to stdout"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "code_arg"
            }
        },
        {
            name: "fmt",
            description: "Format source files",
            options: [
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--ext",
                    description: "Set standard input (stdin) content type",
                    args: {
                        name: "ext"
                    }
                },
                {
                    name: "--ignore",
                    description: "Ignore formatting particular source files",
                    args: {
                        name: "ignore"
                    }
                },
                {
                    name: "--options-line-width",
                    description: "Define maximum line width. Defaults to 80",
                    args: {
                        name: "options-line-width"
                    }
                },
                {
                    name: "--options-indent-width",
                    description: "Define indentation width. Defaults to 2",
                    args: {
                        name: "options-indent-width"
                    }
                },
                {
                    name: "--options-prose-wrap",
                    description: "Define how prose should be wrapped. Defaults to always",
                    args: {
                        name: "options-prose-wrap"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--check",
                    description: "Check if the source files are formatted"
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: "--options-use-tabs",
                    description: "Use tabs instead of spaces for indentation. Defaults to false"
                },
                {
                    name: "--options-single-quote",
                    description: "Use single quotes. Defaults to false"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "files"
            }
        },
        {
            name: "init",
            description: "Initialize a new project",
            options: [
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "dir"
            }
        },
        {
            name: "info",
            description: "Show info about cache or info related to source file",
            options: [
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--location",
                    description: "Show files used for origin bound APIs like the Web Storage API when running a script with '--location=<HREF>'",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--json",
                    description: "UNSTABLE: Outputs the information in JSON format"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "file"
            }
        },
        {
            name: "install",
            description: "Install script as an executable",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--allow-read",
                    description: "Allow file system read access",
                    args: {
                        name: "allow-read"
                    }
                },
                {
                    name: "--allow-write",
                    description: "Allow file system write access",
                    args: {
                        name: "allow-write"
                    }
                },
                {
                    name: "--allow-net",
                    description: "Allow network access",
                    args: {
                        name: "allow-net"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: "--allow-env",
                    description: "Allow environment access",
                    args: {
                        name: "allow-env"
                    }
                },
                {
                    name: "--allow-run",
                    description: "Allow running subprocesses",
                    args: {
                        name: "allow-run"
                    }
                },
                {
                    name: "--allow-ffi",
                    description: "Allow loading dynamic libraries",
                    args: {
                        name: "allow-ffi"
                    }
                },
                {
                    name: "--inspect",
                    description: "Activate inspector on host:port (default: 127.0.0.1:9229)",
                    args: {
                        name: "inspect"
                    }
                },
                {
                    name: "--inspect-brk",
                    description: "Activate inspector on host:port and break at start of user script",
                    args: {
                        name: "inspect-brk"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: ["-n", "--name"],
                    description: "Executable file name",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--root",
                    description: "Installation root",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--allow-hrtime",
                    description: "Allow high resolution time measurement"
                },
                {
                    name: ["-A", "--allow-all"],
                    description: "Allow all permissions"
                },
                {
                    name: "--prompt",
                    description: "Deprecated: Fallback to prompt if required permission wasn't passed"
                },
                {
                    name: "--no-prompt",
                    description: "Always throw if required permission wasn't passed"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: ["-f", "--force"],
                    description: "Forcefully overwrite existing installation"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "cmd"
            }
        },
        {
            name: "uninstall",
            description: "Uninstall a script previously installed with deno install",
            options: [
                {
                    name: "--root",
                    description: "Installation root",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "name"
            }
        },
        {
            name: "lsp",
            description: "Start the language server",
            options: [
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ]
        },
        {
            name: "lint",
            description: "Lint source files",
            options: [
                {
                    name: "--rules-tags",
                    description: "Use set of rules with a tag",
                    args: {
                        name: "rules-tags"
                    }
                },
                {
                    name: "--rules-include",
                    description: "Include lint rules",
                    args: {
                        name: "rules-include"
                    }
                },
                {
                    name: "--rules-exclude",
                    description: "Exclude lint rules",
                    args: {
                        name: "rules-exclude"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--ignore",
                    description: "Ignore linting particular source files",
                    args: {
                        name: "ignore"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--rules",
                    description: "List available rules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--json",
                    description: "Output lint result in JSON format"
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "files"
            }
        },
        {
            name: "repl",
            description: "Read Eval Print Loop",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--inspect",
                    description: "Activate inspector on host:port (default: 127.0.0.1:9229)",
                    args: {
                        name: "inspect"
                    }
                },
                {
                    name: "--inspect-brk",
                    description: "Activate inspector on host:port and break at start of user script",
                    args: {
                        name: "inspect-brk"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: "--eval-file",
                    description: "Evaluates the provided file(s) as scripts when the REPL starts. Accepts file paths and URLs",
                    args: {
                        name: "eval-file"
                    }
                },
                {
                    name: "--eval",
                    description: "Evaluates the provided code when the REPL starts",
                    args: {
                        name: "eval"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ]
        },
        {
            name: "run",
            description: "Run a JavaScript or TypeScript program",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--allow-read",
                    description: "Allow file system read access",
                    args: {
                        name: "allow-read"
                    }
                },
                {
                    name: "--allow-write",
                    description: "Allow file system write access",
                    args: {
                        name: "allow-write"
                    }
                },
                {
                    name: "--allow-net",
                    description: "Allow network access",
                    args: {
                        name: "allow-net"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: "--allow-env",
                    description: "Allow environment access",
                    args: {
                        name: "allow-env"
                    }
                },
                {
                    name: "--allow-run",
                    description: "Allow running subprocesses",
                    args: {
                        name: "allow-run"
                    }
                },
                {
                    name: "--allow-ffi",
                    description: "Allow loading dynamic libraries",
                    args: {
                        name: "allow-ffi"
                    }
                },
                {
                    name: "--inspect",
                    description: "Activate inspector on host:port (default: 127.0.0.1:9229)",
                    args: {
                        name: "inspect"
                    }
                },
                {
                    name: "--inspect-brk",
                    description: "Activate inspector on host:port and break at start of user script",
                    args: {
                        name: "inspect-brk"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically",
                    args: {
                        name: "watch"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--allow-hrtime",
                    description: "Allow high resolution time measurement"
                },
                {
                    name: ["-A", "--allow-all"],
                    description: "Allow all permissions"
                },
                {
                    name: "--prompt",
                    description: "Deprecated: Fallback to prompt if required permission wasn't passed"
                },
                {
                    name: "--no-prompt",
                    description: "Always throw if required permission wasn't passed"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "script_arg"
            }
        },
        {
            name: "task",
            description: "Run a task defined in the configuration file",
            options: [
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--cwd",
                    description: "Specify the directory to run the task in",
                    args: {
                        name: "cwd"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: [
                {
                    name: "task_name"
                },
                {
                    name: "task_args"
                }
            ]
        },
        {
            name: "test",
            description: "Run tests",
            options: [
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--no-check",
                    description: "Skip type-checking modules",
                    args: {
                        name: "no-check"
                    }
                },
                {
                    name: "--check",
                    description: "Type-check modules",
                    args: {
                        name: "check"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: "--allow-read",
                    description: "Allow file system read access",
                    args: {
                        name: "allow-read"
                    }
                },
                {
                    name: "--allow-write",
                    description: "Allow file system write access",
                    args: {
                        name: "allow-write"
                    }
                },
                {
                    name: "--allow-net",
                    description: "Allow network access",
                    args: {
                        name: "allow-net"
                    }
                },
                {
                    name: "--unsafely-ignore-certificate-errors",
                    description: "DANGER: Disables verification of TLS certificates",
                    args: {
                        name: "unsafely-ignore-certificate-errors",
                        description: "Scope ignoring certificate errors to these hosts"
                    }
                },
                {
                    name: "--allow-env",
                    description: "Allow environment access",
                    args: {
                        name: "allow-env"
                    }
                },
                {
                    name: "--allow-run",
                    description: "Allow running subprocesses",
                    args: {
                        name: "allow-run"
                    }
                },
                {
                    name: "--allow-ffi",
                    description: "Allow loading dynamic libraries",
                    args: {
                        name: "allow-ffi"
                    }
                },
                {
                    name: "--inspect",
                    description: "Activate inspector on host:port (default: 127.0.0.1:9229)",
                    args: {
                        name: "inspect"
                    }
                },
                {
                    name: "--inspect-brk",
                    description: "Activate inspector on host:port and break at start of user script",
                    args: {
                        name: "inspect-brk"
                    }
                },
                {
                    name: "--location",
                    description: "Value of 'globalThis.location' used by some web APIs",
                    args: {
                        name: "location"
                    }
                },
                {
                    name: "--v8-flags",
                    description: "Set V8 command line options",
                    args: {
                        name: "v8-flags"
                    }
                },
                {
                    name: "--seed",
                    description: "Set the random number generator seed",
                    args: {
                        name: "seed"
                    }
                },
                {
                    name: "--ignore",
                    description: "Ignore files",
                    args: {
                        name: "ignore"
                    }
                },
                {
                    name: "--fail-fast",
                    description: "Stop after N errors. Defaults to stopping after first failure",
                    args: {
                        name: "fail-fast"
                    }
                },
                {
                    name: "--filter",
                    description: "Run tests with this string or pattern in the test name",
                    args: {
                        name: "filter"
                    }
                },
                {
                    name: "--shuffle",
                    description: "(UNSTABLE): Shuffle the order in which the tests are run",
                    args: {
                        name: "shuffle"
                    }
                },
                {
                    name: "--coverage",
                    description: "UNSTABLE: Collect coverage profile data into DIR",
                    args: {
                        name: "coverage"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Deprecated: Number of parallel workers, defaults to number of available CPUs when no value is provided. Defaults to 1 when the option is not present",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--no-remote",
                    description: "Do not resolve remote modules"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: "--lock-write",
                    description: "Write lock file (use with --lock)"
                },
                {
                    name: "--allow-hrtime",
                    description: "Allow high resolution time measurement"
                },
                {
                    name: ["-A", "--allow-all"],
                    description: "Allow all permissions"
                },
                {
                    name: "--prompt",
                    description: "Deprecated: Fallback to prompt if required permission wasn't passed"
                },
                {
                    name: "--no-prompt",
                    description: "Always throw if required permission wasn't passed"
                },
                {
                    name: "--cached-only",
                    description: "Require that remote dependencies are already cached"
                },
                {
                    name: "--enable-testing-features-do-not-use",
                    description: "INTERNAL: Enable internal features used during integration testing"
                },
                {
                    name: "--compat",
                    description: "UNSTABLE: Node compatibility mode"
                },
                {
                    name: "--no-run",
                    description: "Cache test modules, but don't run tests"
                },
                {
                    name: "--trace-ops",
                    description: "Enable tracing of async ops. Useful when debugging leaking ops in test, but impacts test execution time"
                },
                {
                    name: "--doc",
                    description: "UNSTABLE: type-check code blocks"
                },
                {
                    name: "--allow-none",
                    description: "Don't return error code if no test files are found"
                },
                {
                    name: "--parallel",
                    description: "Run test modules in parallel. Parallelism defaults to the number of available CPUs or the value in the DENO_JOBS environment variable"
                },
                {
                    name: "--watch",
                    description: "Watch for file changes and restart automatically"
                },
                {
                    name: "--no-clear-screen",
                    description: "Do not clear terminal screen when under watch mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: [
                {
                    name: "files"
                },
                {
                    name: "script_arg"
                }
            ]
        },
        {
            name: "types",
            description: "Print runtime TypeScript declarations",
            options: [
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ]
        },
        {
            name: "upgrade",
            description: "Upgrade deno executable to given version",
            options: [
                {
                    name: "--version",
                    description: "The version to upgrade to",
                    args: {
                        name: "version"
                    }
                },
                {
                    name: "--output",
                    description: "The path to output the updated version to",
                    args: {
                        name: "output"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--dry-run",
                    description: "Perform all checks without replacing old exe"
                },
                {
                    name: ["-f", "--force"],
                    description: "Replace current exe even if not out-of-date"
                },
                {
                    name: "--canary",
                    description: "Upgrade to canary builds"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ]
        },
        {
            name: "vendor",
            description: "Vendor remote modules into a local directory",
            options: [
                {
                    name: "--output",
                    description: "The directory to output the vendored modules to",
                    args: {
                        name: "output"
                    }
                },
                {
                    name: ["-c", "--config"],
                    description: "Specify the configuration file",
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "--import-map",
                    description: "Load import map file",
                    args: {
                        name: "import-map"
                    }
                },
                {
                    name: "--lock",
                    description: "Check the specified lock file",
                    args: {
                        name: "lock"
                    }
                },
                {
                    name: ["-r", "--reload"],
                    description: "Reload source code cache (recompile TypeScript)",
                    args: {
                        name: "reload"
                    }
                },
                {
                    name: "--cert",
                    description: "Load certificate authority from PEM encoded file",
                    args: {
                        name: "cert"
                    }
                },
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: ["-f", "--force"],
                    description: "Forcefully overwrite conflicting files in existing output directory"
                },
                {
                    name: "--no-config",
                    description: "Disable automatic loading of the configuration file"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "specifiers"
            }
        },
        {
            name: "help",
            description: "Print this message or the help of the given subcommand(s)",
            options: [
                {
                    name: ["-L", "--log-level"],
                    description: "Set log level",
                    args: {
                        name: "log-level"
                    }
                },
                {
                    name: "--unstable",
                    description: "Enable unstable features and APIs"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Suppress diagnostic output"
                }
            ],
            args: {
                name: "subcommand"
            }
        }
    ],
    options: [
        {
            name: ["-L", "--log-level"],
            description: "Set log level",
            args: {
                name: "log-level"
            }
        },
        {
            name: ["-h", "--help"],
            description: "Print help information"
        },
        {
            name: ["-V", "--version"],
            description: "Print version information"
        },
        {
            name: "--unstable",
            description: "Enable unstable features and APIs"
        },
        {
            name: ["-q", "--quiet"],
            description: "Suppress diagnostic output"
        }
    ]
};
export default completion;
