import { npmScriptsGenerator, npmSearchGenerator } from "./npm";
import type { ArgSpec, CommandSpec, Generator, OptionSpec, SubcommandSpec, Suggestion } from "../spec.types";
export const yarnScriptParserDirectives: ArgSpec["parserDirectives"] = {
    alias: async (token, executeShellCommand) => {
        const npmPrefix = await executeShellCommand({
            command: "npm",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: ["prefix"],
        });
        if (npmPrefix.status !== 0) {
            throw new Error("npm prefix command failed");
        }
        const packageJson = await executeShellCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${npmPrefix.stdout.trim()}/package.json`],
        });
        const script: string = JSON.parse(packageJson.stdout).scripts?.[token];
        if (!script) {
            throw new Error(`Script not found: '${token}'`);
        }
        return script;
    },
};
export const nodeClis = new Set([
    "vue",
    "vite",
    "nuxt",
    "react-native",
    "degit",
    "expo",
    "jest",
    "next",
    "electron",
    "prisma",
    "eslint",
    "prettier",
    "tsc",
    "typeorm",
    "babel",
    "remotion",
    "autocomplete-tools",
    "redwood",
    "rw",
    "create-completion-spec",
    "publish-spec-to-team",
    "capacitor",
    "cap"
]);
// generate global package list from global package.json file
const getGlobalPackagesGenerator: Generator = {
    custom: async (tokens, executeCommand, generatorContext) => {
        const { stdout: yarnGlobalDir } = await executeCommand({
            command: "yarn",
            args: ["global", "dir"],
        });
        const { stdout } = await executeCommand({
            command: "cat",
            // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
            args: [`${yarnGlobalDir.trim()}/package.json`],
        });
        if (stdout.trim() == "")
            return [];
        try {
            const packageContent = JSON.parse(stdout);
            const dependencyScripts = packageContent["dependencies"] || {};
            const devDependencyScripts = packageContent["devDependencies"] || {};
            const dependencies = [
                ...Object.keys(dependencyScripts),
                ...Object.keys(devDependencyScripts)
            ];
            const filteredDependencies = dependencies.filter((dependency) => !tokens.includes(dependency));
            return filteredDependencies.map((dependencyName) => ({
                name: dependencyName,
                icon: "📦",
            }));
        }
        catch (e) { }
        return [];
    },
};
// generate package list of direct and indirect dependencies
const allDependenciesGenerator: Generator = {
    script: ["yarn", "list", "--depth=0", "--json"],
    postProcess: (out) => {
        if (out.trim() == "")
            return [];
        try {
            const packageContent = JSON.parse(out);
            const dependencies = packageContent.data.trees;
            return dependencies.map((dependency: {
                name: string;
            }) => ({
                name: dependency.name.split("@")[0],
                icon: "📦",
            }));
        }
        catch (e) { }
        return [];
    },
};
const configList: Generator = {
    script: ["yarn", "config", "list"],
    postProcess: function (out) {
        if (out.trim() == "") {
            return [];
        }
        try {
            const startIndex = out.indexOf("{");
            const endIndex = out.indexOf("}");
            let output = out.substring(startIndex, endIndex + 1);
            // TODO: fix hacky code
            // reason: JSON parse was not working without double quotes
            output = output
                .replace(/\'/gi, '"')
                .replace("lastUpdateCheck", '"lastUpdateCheck"')
                .replace("registry", '"lastUpdateCheck"');
            const configObject = JSON.parse(output);
            if (configObject) {
                return Object.keys(configObject).map((key) => ({ name: key }));
            }
        }
        catch (e) { }
        return [];
    },
};
export const dependenciesGenerator: Generator = {
    script: [
        "bash",
        "-c",
        "until [[ -f package.json ]] || [[ $PWD = '/' ]]; do cd ..; done; cat package.json"
    ],
    postProcess: function (out, context = []) {
        if (out.trim() === "") {
            return [];
        }
        try {
            const packageContent = JSON.parse(out);
            const dependencies = packageContent["dependencies"] ?? {};
            const devDependencies = packageContent["devDependencies"];
            const optionalDependencies = packageContent["optionalDependencies"] ?? {};
            Object.assign(dependencies, devDependencies, optionalDependencies);
            return Object.keys(dependencies)
                .filter((pkgName) => {
                const isListed = context.some((current) => current === pkgName);
                return !isListed;
            })
                .map((pkgName) => ({
                name: pkgName,
                icon: "📦",
                description: dependencies[pkgName]
                    ? "dependency"
                    : optionalDependencies[pkgName]
                        ? "optionalDependency"
                        : "devDependency",
            }));
        }
        catch (e) {
            console.error(e);
            return [];
        }
    },
};
const commonOptions: OptionSpec[] = [
    { name: ["-s", "--silent"], description: "Skip Yarn console logs" },
    {
        name: "--no-default-rc",
        description: "Prevent Yarn from automatically detecting yarnrc and npmrc files"
    },
    {
        name: "--use-yarnrc",
        description: "Specifies a yarnrc file that Yarn should use (.yarnrc only, not .npmrc) (default: )",
        args: { name: "path" }
    },
    {
        name: "--verbose",
        description: "Output verbose messages on internal operations"
    },
    {
        name: "--offline",
        description: "Trigger an error if any required dependencies are not available in local cache"
    },
    {
        name: "--prefer-offline",
        description: "Use network only if dependencies are not available in local cache"
    },
    {
        name: ["--enable-pnp", "--pnp"],
        description: "Enable the Plug'n'Play installation"
    },
    {
        name: "--json",
        description: "Format Yarn log messages as lines of JSON"
    },
    {
        name: "--ignore-scripts",
        description: "Don't run lifecycle scripts"
    },
    { name: "--har", description: "Save HAR output of network traffic" },
    { name: "--ignore-platform", description: "Ignore platform checks" },
    { name: "--ignore-engines", description: "Ignore engines check" },
    {
        name: "--ignore-optional",
        description: "Ignore optional dependencies"
    },
    {
        name: "--force",
        description: "Install and build packages even if they were built before, overwrite lockfile"
    },
    {
        name: "--skip-integrity-check",
        description: "Run install without checking if node_modules is installed"
    },
    {
        name: "--check-files",
        description: "Install will verify file tree of packages for consistency"
    },
    {
        name: "--no-bin-links",
        description: "Don't generate bin links when setting up packages"
    },
    { name: "--flat", description: "Only allow one version of a package" },
    {
        name: ["--prod", "--production"],
        description: "Instruct Yarn to ignore NODE_ENV and take its production-or-not status from this flag instead"
    },
    {
        name: "--no-lockfile",
        description: "Don't read or generate a lockfile"
    },
    { name: "--pure-lockfile", description: "Don't generate a lockfile" },
    {
        name: "--frozen-lockfile",
        description: "Don't generate a lockfile and fail if an update is needed"
    },
    {
        name: "--update-checksums",
        description: "Update package checksums from current repository"
    },
    {
        name: "--link-duplicates",
        description: "Create hardlinks to the repeated modules in node_modules"
    },
    {
        name: "--link-folder",
        description: "Specify a custom folder to store global links",
        args: { name: "path" }
    },
    {
        name: "--global-folder",
        description: "Specify a custom folder to store global packages",
        args: { name: "path" }
    },
    {
        name: "--modules-folder",
        description: "Rather than installing modules into the node_modules folder relative to the cwd, output them here",
        args: { name: "path" }
    },
    {
        name: "--preferred-cache-folder",
        description: "Specify a custom folder to store the yarn cache if possible",
        args: { name: "path" }
    },
    {
        name: "--cache-folder",
        description: "Specify a custom folder that must be used to store the yarn cache",
        args: { name: "path" }
    },
    {
        name: "--mutex",
        description: "Use a mutex to ensure only one yarn instance is executing",
        args: { name: "type[:specifier]" }
    },
    {
        name: "--emoji",
        description: "Enables emoji in output"
    },
    {
        name: "--cwd",
        description: "Working directory to use",
        args: { name: "cwd" }
    },
    {
        name: ["--proxy", "--https-proxy"],
        description: "",
        args: { name: "host" }
    },
    {
        name: "--registry",
        description: "Override configuration registry",
        args: { name: "url" }
    },
    { name: "--no-progress", description: "Disable progress bar" },
    {
        name: "--network-concurrency",
        description: "Maximum number of concurrent network requests",
        args: { name: "number" }
    },
    {
        name: "--network-timeout",
        description: "TCP timeout for network requests",
        args: { name: "milliseconds" }
    },
    {
        name: "--non-interactive",
        description: "Do not show interactive prompts"
    },
    {
        name: "--scripts-prepend-node-path",
        description: "Prepend the node executable dir to the PATH in scripts"
    },
    {
        name: "--no-node-version-check",
        description: "Do not warn when using a potentially unsupported Node version"
    },
    {
        name: "--focus",
        description: "Focus on a single workspace by installing remote copies of its sibling workspaces"
    },
    {
        name: "--otp",
        description: "One-time password for two factor authentication",
        args: { name: "otpcode" }
    }
];
export const createCLIsGenerator: Generator = {
    script: function (context) {
        if (context[context.length - 1] === "")
            return undefined;
        const searchTerm = "create-" + context[context.length - 1];
        return [
            "curl",
            "-s",
            "-H",
            "Accept: application/json",
            `https://api.npms.io/v2/search?q=${searchTerm}&size=20`
        ];
    },
    cache: {
        ttl: 100 * 24 * 60 * 60 * 3, // 3 days
    },
    postProcess: function (out) {
        try {
            return JSON.parse(out).results.map((item: {
                package: {
                    name: string;
                    description: string;
                };
            }) => ({
                name: item.package.name.substring(7),
                description: item.package.description,
            }) as Suggestion) as Suggestion[];
        }
        catch (e) {
            return [];
        }
    },
};
const completionSpec: CommandSpec = {
    name: "yarn",
    description: "Manage packages and run scripts",
    options: [
        {
            name: "--disable-pnp",
            description: "Disable the Plug'n'Play installation"
        },
        {
            name: "--emoji",
            description: "Enable emoji in output (default: true)",
            args: {
                name: "bool"
            }
        },
        {
            name: ["--enable-pnp", "--pnp"],
            description: "Enable the Plug'n'Play installation"
        },
        {
            name: "--flat",
            description: "Only allow one version of a package"
        },
        {
            name: "--focus",
            description: "Focus on a single workspace by installing remote copies of its sibling workspaces"
        },
        {
            name: "--force",
            description: "Install and build packages even if they were built before, overwrite lockfile"
        },
        {
            name: "--frozen-lockfile",
            description: "Don't generate a lockfile and fail if an update is needed"
        },
        {
            name: "--global-folder",
            description: "Specify a custom folder to store global packages"
        },
        {
            name: "--har",
            description: "Save HAR output of network traffic"
        },
        {
            name: "--https-proxy",
            description: "",
            args: {
                name: "path"
            }
        },
        {
            name: "--ignore-engines",
            description: "Ignore engines check"
        },
        {
            name: "--ignore-optional",
            description: "Ignore optional dependencies"
        },
        {
            name: "--ignore-platform",
            description: "Ignore platform checks"
        },
        {
            name: "--ignore-scripts",
            description: "Don't run lifecycle scripts"
        },
        {
            name: "--json",
            description: "Format Yarn log messages as lines of JSON (see jsonlines.org)"
        },
        {
            name: "--link-duplicates",
            description: "Create hardlinks to the repeated modules in node_modules"
        },
        {
            name: "--link-folder",
            description: "Specify a custom folder to store global links"
        },
        {
            name: "--modules-folder",
            description: "Rather than installing modules into the node_modules folder relative to the cwd, output them here"
        },
        {
            name: "--mutex",
            description: "Use a mutex to ensure only one yarn instance is executing",
            args: [
                {
                    name: "type"
                },
                {
                    name: "specifier"
                }
            ]
        },
        {
            name: "--network-concurrency",
            description: "Maximum number of concurrent network requests",
            args: {
                name: "number"
            }
        },
        {
            name: "--network-timeout",
            description: "TCP timeout for network requests",
            args: {
                name: "milliseconds"
            }
        },
        {
            name: "--no-bin-links",
            description: "Don't generate bin links when setting up packages"
        },
        {
            name: "--no-default-rc",
            description: "Prevent Yarn from automatically detecting yarnrc and npmrc files"
        },
        {
            name: "--no-lockfile",
            description: "Don't read or generate a lockfile"
        },
        {
            name: "--non-interactive",
            description: "Do not show interactive prompts"
        },
        {
            name: "--no-node-version-check",
            description: "Do not warn when using a potentially unsupported Node version"
        },
        {
            name: "--no-progress",
            description: "Disable progress bar"
        },
        {
            name: "--offline",
            description: "Trigger an error if any required dependencies are not available in local cache"
        },
        {
            name: "--otp",
            description: "One-time password for two factor authentication",
            args: {
                name: "otpcode"
            }
        },
        {
            name: "--prefer-offline",
            description: "Use network only if dependencies are not available in local cache"
        },
        {
            name: "--preferred-cache-folder",
            description: "Specify a custom folder to store the yarn cache if possible"
        },
        {
            name: ["--prod", "--production"],
            description: ""
        },
        {
            name: "--proxy",
            description: "",
            args: {
                name: "host"
            }
        },
        {
            name: "--pure-lockfile",
            description: "Don't generate a lockfile"
        },
        {
            name: "--registry",
            description: "Override configuration registry",
            args: {
                name: "url"
            }
        },
        {
            name: ["-s", "--silent"],
            description: "Skip Yarn console logs, other types of logs (script output) will be printed"
        },
        {
            name: "--scripts-prepend-node-path",
            description: "Prepend the node executable dir to the PATH in scripts"
        },
        {
            name: "--skip-integrity-check",
            description: "Run install without checking if node_modules is installed"
        },
        {
            name: "--strict-semver",
            description: ""
        },
        ...commonOptions,
        {
            name: ["-v", "--version"],
            description: "Output the version number"
        },
        {
            name: ["-h", "--help"],
            description: "Output usage information"
        }
    ],
    subcommands: [
        {
            name: "add",
            description: "Installs a package and any packages that it depends on",
            args: {
                name: "package"
            },
            options: [
                ...commonOptions,
                {
                    name: ["-W", "--ignore-workspace-root-check"],
                    description: "Required to run yarn add inside a workspace root"
                },
                {
                    name: ["-D", "--dev"],
                    description: "Save package to your `devDependencies`"
                },
                {
                    name: ["-P", "--peer"],
                    description: "Save package to your `peerDependencies`"
                },
                {
                    name: ["-O", "--optional"],
                    description: "Save package to your `optionalDependencies`"
                },
                {
                    name: ["-E", "--exact"],
                    description: "Install exact version"
                },
                {
                    name: ["-T", "--tilde"],
                    description: "Install most recent release with the same minor version"
                },
                {
                    name: ["-A", "--audit"],
                    description: "Run vulnerability audit on installed packages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "audit",
            description: "Perform a vulnerability audit against the installed packages",
            options: [
                {
                    name: "--summary",
                    description: "Only print the summary"
                },
                {
                    name: "--groups",
                    description: "Only audit dependencies from listed groups. Default: devDependencies, dependencies, optionalDependencies",
                    args: {
                        name: "group_name"
                    }
                },
                {
                    name: "--level",
                    description: "Only print advisories with severity greater than or equal to one of the following: info|low|moderate|high|critical. Default: info",
                    args: {
                        name: "severity"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "autoclean",
            description: "Cleans and removes unnecessary files from package dependencies",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                },
                {
                    name: ["-i", "--init"],
                    description: "Creates the .yarnclean file if it does not exist, and adds the default entries"
                },
                {
                    name: ["-f", "--force"],
                    description: "If a .yarnclean file exists, run the clean process"
                }
            ]
        },
        {
            name: "bin",
            description: "Displays the location of the yarn bin folder",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "cache",
            description: "Yarn cache list will print out every cached package",
            options: [
                ...commonOptions,
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            subcommands: [
                {
                    name: "clean",
                    description: "Clear global cache"
                },
                {
                    name: "dir",
                    description: "Print yarn’s global cache path"
                },
                {
                    name: "list",
                    description: "Print out every cached package",
                    options: [
                        {
                            name: "--pattern",
                            description: "Filter cached packages by pattern",
                            args: {
                                name: "pattern"
                            }
                        }
                    ]
                }
            ]
        },
        {
            name: "config",
            description: "Configure yarn",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            subcommands: [
                {
                    name: "set",
                    description: "Sets the config key to a certain value",
                    options: [
                        {
                            name: ["-g", "--global"],
                            description: "Set global config"
                        }
                    ]
                },
                {
                    name: "get",
                    description: "Print the value for a given key"
                },
                {
                    name: "delete",
                    description: "Deletes a given key from the config"
                },
                {
                    name: "list",
                    description: "Displays the current configuration"
                }
            ]
        },
        {
            name: "create",
            description: "Creates new projects from any create-* starter kits",
            args: {
                name: "cli"
            },
            options: [
                ...commonOptions,
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "exec",
            description: "",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "generate-lock-entry",
            description: "Generates a lock file entry",
            options: [
                {
                    name: "--use-manifest",
                    description: "Specify which manifest file to use for generating lock entry"
                },
                {
                    name: "--resolved",
                    description: "Generate from <*.tgz>#<hash>"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "global",
            description: "Manage yarn globally",
            subcommands: [
                {
                    name: "add",
                    description: "Install globally packages on your operating system",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "bin",
                    description: "Displays the location of the yarn global bin folder"
                },
                {
                    name: "dir",
                    description: "Displays the location of the global installation folder"
                },
                {
                    name: "ls",
                    description: "List globally installed packages (deprecated)"
                },
                {
                    name: "list",
                    description: "List globally installed packages"
                },
                {
                    name: "remove",
                    description: "Remove globally installed packages",
                    args: {
                        name: "package"
                    },
                    options: [
                        ...commonOptions,
                        {
                            name: ["-W", "--ignore-workspace-root-check"],
                            description: "Required to run yarn remove inside a workspace root"
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Output usage information"
                        }
                    ]
                },
                {
                    name: "upgrade",
                    description: "Upgrade globally installed packages",
                    options: [
                        ...commonOptions,
                        {
                            name: ["-S", "--scope"],
                            description: "Upgrade packages under the specified scope",
                            args: { name: "scope" }
                        },
                        {
                            name: ["-L", "--latest"],
                            description: "List the latest version of packages"
                        },
                        {
                            name: ["-E", "--exact"],
                            description: "Install exact version. Only used when --latest is specified"
                        },
                        {
                            name: ["-P", "--pattern"],
                            description: "Upgrade packages that match pattern",
                            args: { name: "pattern" }
                        },
                        {
                            name: ["-T", "--tilde"],
                            description: "Install most recent release with the same minor version. Only used when --latest is specified"
                        },
                        {
                            name: ["-C", "--caret"],
                            description: "Install most recent release with the same major version. Only used when --latest is specified"
                        },
                        {
                            name: ["-A", "--audit"],
                            description: "Run vulnerability audit on installed packages"
                        },
                        { name: ["-h", "--help"], description: "Output usage information" }
                    ]
                },
                {
                    name: "upgrade-interactive",
                    description: "Display the outdated packages before performing any upgrade",
                    options: [
                        {
                            name: "--latest",
                            description: "Use the version tagged latest in the registry"
                        }
                    ]
                }
            ],
            options: [
                ...commonOptions,
                {
                    name: "--prefix",
                    description: "Bin prefix to use to install binaries",
                    args: {
                        name: "prefix"
                    }
                },
                {
                    name: "--latest",
                    description: "Bin prefix to use to install binaries"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "help",
            description: "Output usage information"
        },
        {
            name: "import",
            description: "Generates yarn.lock from an npm package-lock.json file"
        },
        {
            name: "info",
            description: "Show information about a package"
        },
        {
            name: "init",
            description: "Interactively creates or updates a package.json file",
            options: [
                ...commonOptions,
                {
                    name: ["-y", "--yes"],
                    description: "Use default options"
                },
                {
                    name: ["-p", "--private"],
                    description: "Use default options and private true"
                },
                {
                    name: ["-i", "--install"],
                    description: "Install a specific Yarn release",
                    args: {
                        name: "version"
                    }
                },
                {
                    name: "-2",
                    description: "Generates the project using Yarn 2"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "install",
            description: "Install all the dependencies listed within package.json",
            options: [
                ...commonOptions,
                {
                    name: ["-A", "--audit"],
                    description: "Run vulnerability audit on installed packages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "licenses",
            description: "",
            subcommands: [
                {
                    name: "list",
                    description: "List licenses for installed packages"
                },
                {
                    name: "generate-disclaimer",
                    description: "List of licenses from all the packages"
                }
            ]
        },
        {
            name: "link",
            description: "Symlink a package folder during development",
            args: {
                name: "package"
            },
            options: [
                ...commonOptions,
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "list",
            description: "Lists all dependencies for the current working directory",
            options: [
                {
                    name: "--depth",
                    description: "Restrict the depth of the dependencies"
                },
                {
                    name: "--pattern",
                    description: "Filter the list of dependencies by the pattern"
                }
            ]
        },
        {
            name: "login",
            description: "Store registry username and email"
        },
        {
            name: "logout",
            description: "Clear registry username and email"
        },
        {
            name: "node",
            description: ""
        },
        {
            name: "outdated",
            description: "Checks for outdated package dependencies",
            options: [
                ...commonOptions,
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "owner",
            description: "Manage package owners",
            subcommands: [
                {
                    name: "list",
                    description: "Lists all of the owners of a package",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "add",
                    description: "Adds the user as an owner of the package",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "remove",
                    description: "Removes the user as an owner of the package",
                    args: [
                        {
                            name: "user"
                        },
                        {
                            name: "package"
                        }
                    ]
                }
            ]
        },
        {
            name: "pack",
            description: "Creates a compressed gzip archive of package dependencies",
            options: [
                {
                    name: "--filename",
                    description: "Creates a compressed gzip archive of package dependencies and names the file filename"
                }
            ]
        },
        {
            name: "policies",
            description: "Defines project-wide policies for your project",
            subcommands: [
                {
                    name: "set-version",
                    description: "Will download the latest stable release",
                    options: [
                        {
                            name: "--rc",
                            description: "Download the latest rc release"
                        }
                    ]
                }
            ]
        },
        {
            name: "publish",
            description: "Publishes a package to the npm registry",
            args: { name: "Tarball or Folder" },
            options: [
                ...commonOptions,
                { name: ["-h", "--help"], description: "Output usage information" },
                {
                    name: "--major",
                    description: "Auto-increment major version number"
                },
                {
                    name: "--minor",
                    description: "Auto-increment minor version number"
                },
                {
                    name: "--patch",
                    description: "Auto-increment patch version number"
                },
                {
                    name: "--premajor",
                    description: "Auto-increment premajor version number"
                },
                {
                    name: "--preminor",
                    description: "Auto-increment preminor version number"
                },
                {
                    name: "--prepatch",
                    description: "Auto-increment prepatch version number"
                },
                {
                    name: "--prerelease",
                    description: "Auto-increment prerelease version number"
                },
                {
                    name: "--preid",
                    description: "Add a custom identifier to the prerelease",
                    args: { name: "preid" }
                },
                {
                    name: "--message",
                    description: "Message",
                    args: { name: "message" }
                },
                { name: "--no-git-tag-version", description: "No git tag version" },
                {
                    name: "--no-commit-hooks",
                    description: "Bypass git hooks when committing new version"
                },
                { name: "--access", description: "Access", args: { name: "access" } },
                { name: "--tag", description: "Tag", args: { name: "tag" } }
            ]
        },
        {
            name: "remove",
            description: "Remove installed package",
            options: [
                ...commonOptions,
                {
                    name: ["-W", "--ignore-workspace-root-check"],
                    description: "Required to run yarn remove inside a workspace root"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            name: "run",
            description: "Runs a defined package script",
            options: [
                ...commonOptions,
                { name: ["-h", "--help"], description: "Output usage information" }
            ],
            args: [
                {
                    name: "script",
                    description: "Script to run from your package.json"
                },
                {
                    name: "env",
                    description: "Lists environment variables available to scripts"
                }
            ]
        },
        {
            name: "tag",
            description: "Add, remove, or list tags on a package"
        },
        {
            name: "team",
            description: "Maintain team memberships",
            subcommands: [
                {
                    name: "create",
                    description: "Create a new team",
                    args: {
                        name: "<scope:team>"
                    }
                },
                {
                    name: "destroy",
                    description: "Destroys an existing team",
                    args: {
                        name: "<scope:team>"
                    }
                },
                {
                    name: "add",
                    description: "Add a user to an existing team",
                    args: [
                        {
                            name: "<scope:team>"
                        },
                        {
                            name: "<user>"
                        }
                    ]
                },
                {
                    name: "remove",
                    description: "Remove a user from a team they belong to",
                    args: {
                        name: "<scope:team> <user>"
                    }
                },
                {
                    name: "list",
                    description: "If performed on an organization name, will return a list of existing teams under that organization. If performed on a team, it will instead return a list of all users belonging to that particular team",
                    args: {
                        name: "<scope>|<scope:team>"
                    }
                }
            ]
        },
        {
            name: "unlink",
            description: "Unlink a previously created symlink for a package"
        },
        {
            name: "unplug",
            description: ""
        },
        {
            name: "upgrade",
            description: "Upgrades packages to their latest version based on the specified range",
            args: {
                name: "package"
            },
            options: [
                ...commonOptions,
                {
                    name: ["-S", "--scope"],
                    description: "Upgrade packages under the specified scope",
                    args: { name: "scope" }
                },
                {
                    name: ["-L", "--latest"],
                    description: "List the latest version of packages"
                },
                {
                    name: ["-E", "--exact"],
                    description: "Install exact version. Only used when --latest is specified"
                },
                {
                    name: ["-P", "--pattern"],
                    description: "Upgrade packages that match pattern",
                    args: { name: "pattern" }
                },
                {
                    name: ["-T", "--tilde"],
                    description: "Install most recent release with the same minor version. Only used when --latest is specified"
                },
                {
                    name: ["-C", "--caret"],
                    description: "Install most recent release with the same major version. Only used when --latest is specified"
                },
                {
                    name: ["-A", "--audit"],
                    description: "Run vulnerability audit on installed packages"
                },
                { name: ["-h", "--help"], description: "Output usage information" }
            ]
        },
        {
            name: "upgrade-interactive",
            description: "Upgrades packages in interactive mode",
            options: [
                {
                    name: "--latest",
                    description: "Use the version tagged latest in the registry"
                }
            ]
        },
        {
            name: "version",
            description: "Update version of your package",
            options: [
                ...commonOptions,
                { name: ["-h", "--help"], description: "Output usage information" },
                {
                    name: "--new-version",
                    description: "New version",
                    args: { name: "version" }
                },
                {
                    name: "--major",
                    description: "Auto-increment major version number"
                },
                {
                    name: "--minor",
                    description: "Auto-increment minor version number"
                },
                {
                    name: "--patch",
                    description: "Auto-increment patch version number"
                },
                {
                    name: "--premajor",
                    description: "Auto-increment premajor version number"
                },
                {
                    name: "--preminor",
                    description: "Auto-increment preminor version number"
                },
                {
                    name: "--prepatch",
                    description: "Auto-increment prepatch version number"
                },
                {
                    name: "--prerelease",
                    description: "Auto-increment prerelease version number"
                },
                {
                    name: "--preid",
                    description: "Add a custom identifier to the prerelease",
                    args: { name: "preid" }
                },
                {
                    name: "--message",
                    description: "Message",
                    args: { name: "message" }
                },
                { name: "--no-git-tag-version", description: "No git tag version" },
                {
                    name: "--no-commit-hooks",
                    description: "Bypass git hooks when committing new version"
                },
                { name: "--access", description: "Access", args: { name: "access" } },
                { name: "--tag", description: "Tag", args: { name: "tag" } }
            ]
        },
        {
            name: "versions",
            description: "Displays version information of the currently installed Yarn, Node.js, and its dependencies"
        },
        {
            name: "why",
            description: "Show information about why a package is installed",
            args: {
                name: "package"
            },
            options: [
                ...commonOptions,
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                },
                {
                    name: "--peers",
                    description: "Print the peer dependencies that match the specified name"
                },
                {
                    name: ["-R", "--recursive"],
                    description: "List, for each workspace, what are all the paths that lead to the dependency"
                }
            ]
        },
        {
            name: "workspace",
            description: "Manage workspace"
        },
        {
            name: "workspaces",
            description: "Show information about your workspaces",
            options: [
                {
                    name: "subcommand",
                    description: ""
                },
                {
                    name: "flags",
                    description: ""
                }
            ]
        },
        {
            name: "set",
            description: "Set global Yarn options",
            subcommands: [
                {
                    name: "resolution",
                    description: "Enforce a package resolution",
                    args: [
                        {
                            name: "descriptor",
                            description: "A descriptor for the package, in the form of 'lodash@npm:^1.2.3'"
                        },
                        {
                            name: "resolution",
                            description: "The version of the package to resolve"
                        }
                    ],
                    options: [
                        {
                            name: ["-s", "--save"],
                            description: "Persist the resolution inside the top-level manifest"
                        }
                    ]
                },
                {
                    name: "version",
                    description: "Lock the Yarn version used by the project",
                    args: {
                        name: "version",
                        description: "Use the specified version, which can also be a Yarn 2 build (e.g 2.0.0-rc.30) or a Yarn 1 build (e.g 1.22.1)"
                    },
                    options: [
                        {
                            name: "--only-if-needed",
                            description: "Only lock the Yarn version if it isn't already locked"
                        }
                    ]
                }
            ]
        }
    ]
};
export default completionSpec;
