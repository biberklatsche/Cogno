import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "vite",
    description: "Native ESM-powered web dev build tool",
    options: [
        {
            name: ["-h", "--help"],
            description: "Show help message"
        },
        {
            name: "--host",
            description: "Specify the hostname",
            args: { name: "host" }
        },
        {
            name: "--port",
            description: "Specify the port",
            args: { name: "port" }
        },
        {
            name: "--https",
            description: "Use TLS + HTTP/2"
        },
        {
            name: "--open",
            description: "Open browser on startup",
            args: {
                name: "browser"
            }
        },
        {
            name: "--cors",
            description: "Enable CORS"
        },
        {
            name: "--strictPort",
            description: "Exit if the port is already in use"
        },
        {
            name: "--force",
            description: "For the optimizer to re-bundle"
        },
        {
            name: ["-c", "--config"],
            description: "Use the specified config file",
            args: {
                name: "file"
            }
        },
        {
            name: "--base",
            description: "Public base path",
            args: {
                name: "path"
            }
        },
        {
            name: ["-l", "--logLevel"],
            description: "Set the log level",
            args: {
                name: "level"
            }
        },
        {
            name: "--clearScreen",
            description: "Enable screen clearing when logging"
        },
        {
            name: ["-d", "--debug"],
            description: "Show debug logs",
            args: {
                name: "feat"
            }
        },
        {
            name: ["-f", "--filter"],
            description: "Filter debug logs",
            args: {
                name: "filter"
            }
        },
        {
            name: ["-m", "--mode"],
            description: "Set env mode",
            args: {
                name: "mode"
            }
        },
        {
            name: ["-v", "--version"],
            description: "Display version number"
        }
    ],
    subcommands: [
        {
            name: "build",
            description: "Build for production",
            args: {
                name: "root"
            },
            options: [
                {
                    name: "--target",
                    description: "Transpile target (must be a valid esbuild target)",
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--outDir",
                    description: "Output directory",
                    args: {
                        name: "dir"
                    }
                },
                {
                    name: "--assetsDir",
                    description: "Directory under outDir to place assets in",
                    args: {
                        name: "dir"
                    }
                },
                {
                    name: "--assetsInlineLimit",
                    description: "Static asset base64 inline threshold in bytes",
                    args: {
                        name: "number"
                    }
                },
                {
                    name: "--ssr",
                    description: "Build specified entry for server-side rendering",
                    args: {
                        name: "entry"
                    }
                },
                {
                    name: "--sourcemap",
                    description: "Output sourcemaps for build"
                },
                {
                    name: "--minify",
                    description: "Enable minification",
                    args: {
                        name: "minifier"
                    }
                },
                {
                    name: "--manifest",
                    description: "Emit build manifest json",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--ssrManifest",
                    description: "Emit ssr manifest json",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--emptyOutDir",
                    description: "Force empty outDir when it's outside of root"
                },
                {
                    name: ["-w", "--watch"],
                    description: "Rebuilds when modules have changed on disk"
                }
            ]
        },
        {
            name: "optimize",
            description: "Pre-bundle dependencies",
            args: {
                name: "root"
            },
            options: [
                {
                    name: "--force",
                    description: "For the optimizer to re-bundle"
                }
            ]
        },
        {
            name: "preview",
            description: "Locally preview the production build",
            args: {
                name: "root"
            },
            options: [
                {
                    name: "--host",
                    description: "Specify the hostname",
                    args: { name: "host" }
                },
                {
                    name: "--port",
                    description: "Specify the port",
                    args: { name: "port" }
                },
                {
                    name: "--https",
                    description: "Use TLS + HTTP/2"
                },
                {
                    name: "--open",
                    description: "Open browser on startup",
                    args: {
                        name: "browser"
                    }
                },
                {
                    name: "--strictPort",
                    description: "Exit if the port is already in use"
                }
            ]
        }
    ]
};
export default completionSpec;
