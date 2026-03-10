import { filepaths, keyValue } from "@fig/autocomplete-generators";
import type { CommandSpec, Generator, OptionSpec, SubcommandSpec, Suggestion } from "../spec.types";
const rustEditions: Suggestion[] = [
    {
        name: "2015",
        description: "2015 edition",
    },
    {
        name: "2018",
        description: "2018 edition",
    },
    {
        name: "2021",
        description: "2021 edition",
    }
];
const vcsOptions: {
    name: string;
    icon: string;
    description: string;
}[] = [
    {
        name: "git",
        icon: "fig://icon?type=git",
        description: "Initialize with Git",
    },
    {
        name: "hg",
        icon: "⚗️",
        description: "Initialize with Mercurial",
    },
    {
        name: "pijul",
        icon: "🦜",
        description: "Initialize with Pijul",
    },
    {
        name: "fossil",
        icon: "🦴",
        description: "Initialize with Fossil",
    },
    {
        name: "none",
        icon: "🚫",
        description: "Initialize with no VCS",
    }
];
// TODO(grant): add this back but better with no awk
// const testGenerator: Generator = {
//   cache: {
//     cacheByDirectory: true,
//     strategy: "stale-while-revalidate",
//     ttl: 1000 * 60 * 5,
//   },
//   script: (context) => {
//     const base = context[context.length - 1];
//     // allow split by single colon so that it triggers on a::b:
//     const indexIntoModPath = Math.max(base.split(/::?/).length, 1);
//     // split by :: so that tokens with a single colon are allowed
//     const moduleTokens = base.split("::");
//     const lastModule = moduleTokens.pop();
//     // check if the token has a : on the end
//     const hasColon = lastModule[lastModule.length - 1] == ":" ? ":" : "";
//     return `cargo t -- --list | awk '/: test$/ { print substr($1, 1, length($1) - 1) }' | awk -F "::" '{ print "${hasColon}"$${indexIntoModPath},int( NF / ${indexIntoModPath} ) }'`;
//   },
//   postProcess: (out) => {
//     return [...new Set(out.split("\n"))].map((line) => {
//       const [display, last] = line.split(" ");
//       const lastModule = parseInt(last);
//       const displayName = display.replaceAll(":", "");
//       const name = displayName.length
//         ? `${display}${lastModule ? "" : "::"}`
//         : "";
//       return { name, displayName };
//     });
//   },
//   trigger: ":",
//   getQueryTerm: ":",
// };
type Metadata = {
    packages: Package[];
    resolve: Resolve;
    workspace_root: string;
};
type Package = {
    name: string;
    version: string;
    id: string;
    description?: string;
    source?: string;
    targets: Target[];
    dependencies: Dependency[];
};
type Target = {
    name: string;
    src_path: string;
    kind: TargetKind[];
};
type Dependency = {
    name: string;
    req: string;
    kind: "dev" | "build" | null;
    target: string | null;
};
type TargetKind = "lib" | "bin" | "example" | "test" | "bench" | "custom-build";
type Resolve = {
    root?: string;
};
const rootPackageOrLocal = (manifest: Metadata) => {
    const rootManifestPath = `${manifest.workspace_root}/Cargo.toml`;
    console.log(rootManifestPath);
    const rootPackage = manifest.packages.find((pkg) => pkg.source === rootManifestPath);
    return rootPackage
        ? [rootPackage]
        : manifest.packages.filter((pkg) => !pkg.source);
};
const packageGenerator: Generator = {
    script: ["cargo", "metadata", "--format-version", "1", "--no-deps"],
    postProcess: (data) => {
        const manifest: Metadata = JSON.parse(data);
        return manifest.packages.map((pkg) => {
            return {
                icon: "📦",
                name: pkg.name,
                description: `${pkg.version}${pkg.description ? ` - ${pkg.description}` : ""}`,
            };
        });
    },
};
const directDependencyGenerator: Generator = {
    script: ["cargo", "metadata", "--format-version", "1"],
    postProcess: (data: string) => {
        const manifest: Metadata = JSON.parse(data);
        const packages = rootPackageOrLocal(manifest);
        const deps = packages
            .flatMap((pkg) => pkg.dependencies)
            .map((dep) => ({
            name: dep.name,
            description: dep.req,
        }));
        return [...new Map(deps.map((dep) => [dep.name, dep])).values()];
    },
};
const targetGenerator: ({ kind }: {
    kind?: TargetKind;
}) => Generator = ({ kind, }) => ({
    custom: async (_, executeShellCommand, context) => {
        const { stdout } = await executeShellCommand({
            command: "cargo",
            args: ["metadata", "--format-version", "1", "--no-deps"],
        });
        const manifest: Metadata = JSON.parse(stdout);
        const packages = rootPackageOrLocal(manifest);
        let targets = packages.flatMap((pkg) => pkg.targets);
        if (kind) {
            targets = targets.filter((target) => target.kind.includes(kind));
        }
        return targets.map((pkg) => {
            const path = pkg.src_path.replace(context.currentWorkingDirectory, "");
            return {
                icon: "🎯",
                name: pkg.name,
                description: path,
            };
        });
    },
});
const dependencyGenerator: Generator = {
    script: ["cargo", "metadata", "--format-version", "1"],
    postProcess: (data: string) => {
        const metadata: Metadata = JSON.parse(data);
        return metadata.packages.map((pkg) => ({
            name: pkg.name,
            description: pkg.description,
        }));
    },
};
const featuresGenerator: Generator = {
    script: ["cargo", "read-manifest"],
    postProcess: (data: string) => {
        const manifest = JSON.parse(data);
        return Object.keys(manifest.features || {}).map((name) => ({
            icon: "🎚",
            name,
            description: `Features: [${manifest.features[name].join(", ")}]`,
        }));
    },
};
const makeTasksGenerator: Generator = {
    custom: async function (tokens, executeCommand) {
        let makefileLocation = "Makefile.toml";
        const makefileFlagIdx = tokens.findIndex((param) => param === "--makefile");
        if (makefileFlagIdx !== -1 && tokens.length > makefileFlagIdx + 1)
            makefileLocation = tokens[makefileFlagIdx + 1];
        const args = [makefileLocation];
        const { stdout } = await executeCommand({
            command: "cat",
            args,
        });
        const taskRegex = /\[tasks\.([^\]]+)\]/g;
        let match;
        const tasks = [];
        while ((match = taskRegex.exec(stdout)) !== null) {
            tasks.push({
                name: match[1],
            });
        }
        return tasks;
    },
};
type CrateSearchResults = {
    crates: Crate[];
};
type Crate = {
    description?: string;
    name: string;
    newest_version: string;
    recent_downloads: number;
};
type VersionSearchResults = {
    versions: Version[];
};
type Version = {
    num: string;
    downloads: number;
    created_at: string;
    yanked: boolean;
};
// Search for crates
// If context is empty, return the most downloaded crates for the search term,
// if there is an `@` in the context, return the versions for the crate
export const searchGenerator: Generator = {
    custom: async (context, executeShellCommand) => {
        const numberFormatter = new Intl.NumberFormat(undefined, {
            notation: "compact",
            compactDisplay: "short",
            maximumSignificantDigits: 3,
        });
        const lastToken = context[context.length - 1];
        if (lastToken.includes("@") && !lastToken.startsWith("@")) {
            const [crate, _version] = lastToken.split("@");
            const query = encodeURIComponent(crate);
            const { stdout } = await executeShellCommand({
                command: "curl",
                args: ["-sfL", `https://crates.io/api/v1/crates/${query}/versions`],
            });
            const json: VersionSearchResults = JSON.parse(stdout);
            return json.versions.map((version) => ({
                name: `${crate}@${version.num}`,
                insertValue: `${version.num}`,
                description: `${numberFormatter.format(version.downloads)} downloads - ${new Date(version.created_at).toLocaleDateString()}`,
                hidden: version.yanked,
            }));
        }
        else if (lastToken.length > 0) {
            const query = encodeURIComponent(lastToken);
            const [{ stdout: remoteStdout }, { stdout: localStdout }] = await Promise.all([
                executeShellCommand({
                    command: "curl",
                    args: [
                        "-sfL",
                        `https://crates.io/api/v1/crates?q=${query}&per_page=60`
                    ],
                }),
                executeShellCommand({
                    command: "cargo",
                    args: ["metadata", "--format-version", "1", "--no-deps"],
                })
            ]);
            const remoteJson: CrateSearchResults = JSON.parse(remoteStdout);
            const remoteSuggustions: Suggestion[] = remoteJson.crates
                .sort((a, b) => b.recent_downloads - a.recent_downloads)
                .map((crate) => ({
                icon: "📦",
                displayName: `${crate.name}@${crate.newest_version}`,
                name: crate.name,
                description: `${numberFormatter.format(crate.recent_downloads)}${crate.description ? ` - ${crate.description}` : ""}`,
            }));
            let localSuggestions: Suggestion[] = [];
            if (localStdout.trim().length > 0) {
                const localJson: Metadata = JSON.parse(localStdout);
                localSuggestions = localJson.packages
                    .filter((pkg) => !pkg.source)
                    .map((pkg) => ({
                    icon: "📦",
                    displayName: `${pkg.name}@${pkg.version}`,
                    name: pkg.name,
                    description: `Local Crate ${pkg.version}${pkg.description ? ` - ${pkg.description}` : ""}`,
                }));
            }
            return remoteSuggustions.concat(localSuggestions);
        }
        else {
            return [];
        }
    },
    trigger: (oldTokens, newTokens) => {
        const atIndexOld = oldTokens.indexOf("@");
        const atIndexNew = newTokens.indexOf("@");
        return ((atIndexOld === -1 && atIndexNew === -1) || atIndexOld !== atIndexNew);
    },
    getQueryTerm: "@",
};
const tripleGenerator: Generator = {
    script: ["rustc", "--print", "target-list"],
    postProcess: (data: string) => {
        return data
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((name) => ({
            name,
        }));
    },
};
const tomlBool: Suggestion[] = [
    {
        name: "true",
    },
    {
        name: "false",
    }
];
const configPairs: Record<string, Omit<Suggestion, "name"> & {
    tomlSuggestions?: Suggestion[];
}> = {
    "build.jobs": {
        description: "Sets the maximum number of compiler processes to run in parallel",
    },
    "build.rustc": {
        description: "Path to the rustc compiler",
    },
    "build.rustc-wrapper": {
        description: "Sets a wrapper to execute instead of rustc",
    },
    "build.target": {
        description: "The default target platform triples to compile to",
    },
    "build.target-dir": {
        description: "The path to where all compiler output is placed",
    },
    "build.rustflags": {
        description: "Extra command-line flags to pass to rustc",
    },
    "build.rustdocflags": {
        description: "Extra command-line flags to pass to rustdoc",
    },
    "build.incremental": {
        description: "Whether or not to perform incremental compilation",
        tomlSuggestions: tomlBool,
    },
    "build.dep-info-basedir": {
        description: "Strips the given path prefix from dep info file paths",
    },
    "doc.browser": {
        description: "This option sets the browser to be used by cargo doc, overriding the BROWSER environment variable when opening documentation with the --open option",
    },
    "cargo-new.vcs": {
        description: "Specifies the source control system to use for initializing a new repository",
        tomlSuggestions: vcsOptions.map((vcs) => ({
            ...vcs,
            name: `\\"${vcs.name}\\"`,
            insertValue: `\\"${vcs.name}\\"`,
        })),
    },
    "future-incompat-report.frequency": {
        description: "Controls how often we display a notification to the terminal when a future incompat report is available",
        tomlSuggestions: [
            {
                name: '\\"always\\"',
                // eslint-disable-next-line @withfig/fig-linter/no-useless-insertvalue
                insertValue: '\\"always\\"',
                description: "Always display a notification when a command (e.g. cargo build) produces a future incompat report",
            },
            {
                name: '\\"never\\"',
                // eslint-disable-next-line @withfig/fig-linter/no-useless-insertvalue
                insertValue: '\\"never\\"',
                description: "Never display a notification",
            }
        ],
    },
    "http.debug": {
        description: "If true, enables debugging of HTTP requests",
        tomlSuggestions: tomlBool,
    },
    "http.proxy": {
        description: "Sets an HTTP and HTTPS proxy to use",
    },
    "http.timeout": {
        description: "Sets the timeout for each HTTP request, in seconds",
    },
    "http.cainfo": {
        description: "Sets the path to a CA certificate bundle",
    },
    "http.check-revoke": {
        description: "This determines whether or not TLS certificate revocation checks should be performed. This only works on Windows",
        tomlSuggestions: tomlBool,
    },
    "http.ssl-version": {
        description: "This sets the minimum TLS version to use",
    },
    "http.low-speed-limit": {
        description: "This setting controls timeout behavior for slow connections",
    },
    "http.multiplexing": {
        description: "When `true`, Cargo will attempt to use the HTTP2 protocol with multiplexing",
        tomlSuggestions: tomlBool,
    },
    "http.user-agent": {
        description: "Specifies a custom user-agent header to use",
    },
    "install.root": {
        description: "Sets the path to the root directory for installing executables for `cargo install`",
    },
    "net.retry": {
        description: "Number of times to retry possibly spurious network errors",
    },
    "net.git-fetch-with-cli": {
        description: "If this is `true`, then Cargo will use the git executable to fetch registry indexes and git dependencies. If `false`, then it uses a built-in git library",
        tomlSuggestions: tomlBool,
    },
    "net.offline": {
        description: "If this is true, then Cargo will avoid accessing the network, and attempt to proceed with locally cached data",
        tomlSuggestions: tomlBool,
    },
};
// Configs are in the format `key=value` where value is a toml value
const configGenerator: Generator = keyValue({
    keys: Object.entries(configPairs).map(([key, other]) => ({
        name: key,
        ...other,
    })),
    values: async (tokens, execute) => {
        const key = tokens[tokens.length - 1].split("=")?.[0];
        const pair = configPairs[key];
        if (pair?.tomlSuggestions) {
            return pair.tomlSuggestions;
        }
    },
    separator: "=",
});
const completionSpec: (toolchain?: boolean) => CommandSpec = (toolchain = true) => ({
    name: "cargo",
    description: "CLI Interface for Cargo",
    subcommands: [
        {
            name: "bench",
            description: "Execute all benchmarks of a local package",
            options: [
                {
                    name: "--bin",
                    description: "Benchmark only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Benchmark only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Benchmark only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Benchmark only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to run benchmarks for",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the benchmark",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--lib",
                    description: "Benchmark only this package's library"
                },
                {
                    name: "--bins",
                    description: "Benchmark all binaries"
                },
                {
                    name: "--examples",
                    description: "Benchmark all examples"
                },
                {
                    name: "--tests",
                    description: "Benchmark all tests"
                },
                {
                    name: "--benches",
                    description: "Benchmark all benches"
                },
                {
                    name: "--all-targets",
                    description: "Benchmark all targets"
                },
                {
                    name: "--no-run",
                    description: "Compile, but don't run benchmarks"
                },
                {
                    name: "--workspace",
                    description: "Benchmark all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--no-fail-fast",
                    description: "Run all benchmarks regardless of failure"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: [
                {
                    name: "BENCHNAME"
                },
                {
                    name: "args"
                }
            ]
        },
        {
            name: ["build", "b"],
            description: "Compile a local package and all of its dependencies",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to build (see `cargo help pkgid`)",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the build",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Build only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Build only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Build only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Build only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--out-dir",
                    description: "Copy final artifacts to this directory (unstable)",
                    args: {
                        name: "out-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--workspace",
                    description: "Build all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: "--lib",
                    description: "Build only this package's library"
                },
                {
                    name: "--bins",
                    description: "Build all binaries"
                },
                {
                    name: "--examples",
                    description: "Build all examples"
                },
                {
                    name: "--tests",
                    description: "Build all tests"
                },
                {
                    name: "--benches",
                    description: "Build all benches"
                },
                {
                    name: "--all-targets",
                    description: "Build all targets"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--build-plan",
                    description: "Output the build plan in JSON (unstable)"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--future-incompat-report",
                    description: "Outputs a future incompatibility report at the end of the build"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ]
        },
        {
            name: ["check", "c"],
            description: "Check a local package and all of its dependencies for errors",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package(s) to check",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the check",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Check only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Check only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Check only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Check only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: "--profile",
                    description: "Check artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Check for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--workspace",
                    description: "Check all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: "--lib",
                    description: "Check only this package's library"
                },
                {
                    name: "--bins",
                    description: "Check all binaries"
                },
                {
                    name: "--examples",
                    description: "Check all examples"
                },
                {
                    name: "--tests",
                    description: "Check all tests"
                },
                {
                    name: "--benches",
                    description: "Check all benches"
                },
                {
                    name: "--all-targets",
                    description: "Check all targets"
                },
                {
                    name: ["-r", "--release"],
                    description: "Check artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--future-incompat-report",
                    description: "Outputs a future incompatibility report at the end of the build"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ]
        },
        {
            name: "clean",
            description: "Remove artifacts that cargo has generated in the past",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to clean artifacts for",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--target",
                    description: "Target triple to clean output for",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--profile",
                    description: "Clean artifacts of the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-r", "--release"],
                    description: "Whether or not to clean release artifacts"
                },
                {
                    name: "--doc",
                    description: "Whether or not to clean just the documentation directory"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "config",
            description: "Inspect configuration values",
            subcommands: [
                {
                    name: "get",
                    options: [
                        {
                            name: "--format",
                            description: "Display format",
                            args: {
                                name: "format"
                            }
                        },
                        {
                            name: "--merged",
                            description: "Whether or not to merge config values",
                            args: {
                                name: "merged"
                            }
                        },
                        {
                            name: "--color",
                            description: "Coloring: auto, always, never",
                            args: {
                                name: "color"
                            }
                        },
                        {
                            name: "--config",
                            description: "Override a configuration value",
                            isRepeatable: true,
                            args: {
                                name: "config"
                            }
                        },
                        {
                            name: "-Z",
                            description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                            isRepeatable: true,
                            args: {
                                name: "unstable-features"
                            }
                        },
                        {
                            name: "--version",
                            description: "Print version information"
                        },
                        {
                            name: "--show-origin",
                            description: "Display where the config value is defined"
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        },
                        {
                            name: ["-v", "--verbose"],
                            description: "Use verbose output (-vv very verbose/build.rs output)",
                            isRepeatable: true
                        },
                        {
                            name: "--frozen",
                            description: "Require Cargo.lock and cache are up to date"
                        },
                        {
                            name: "--locked",
                            description: "Require Cargo.lock is up to date"
                        },
                        {
                            name: "--offline",
                            description: "Run without accessing the network"
                        }
                    ]
                },
                {
                    name: "help",
                    description: "Print this message or the help of the given subcommand(s)",
                    options: [
                        {
                            name: "--color",
                            description: "Coloring: auto, always, never",
                            args: {
                                name: "color"
                            }
                        },
                        {
                            name: "--config",
                            description: "Override a configuration value",
                            isRepeatable: true,
                            args: {
                                name: "config"
                            }
                        },
                        {
                            name: "-Z",
                            description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                            isRepeatable: true,
                            args: {
                                name: "unstable-features"
                            }
                        },
                        {
                            name: "--version",
                            description: "Print version information"
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        },
                        {
                            name: ["-v", "--verbose"],
                            description: "Use verbose output (-vv very verbose/build.rs output)",
                            isRepeatable: true
                        },
                        {
                            name: "--frozen",
                            description: "Require Cargo.lock and cache are up to date"
                        },
                        {
                            name: "--locked",
                            description: "Require Cargo.lock is up to date"
                        },
                        {
                            name: "--offline",
                            description: "Run without accessing the network"
                        }
                    ],
                    args: {
                        name: "subcommand"
                    }
                }
            ],
            options: [
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: ["doc", "d"],
            description: "Build a package's documentation",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to document",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the build",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Document only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Document only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--open",
                    description: "Opens the docs in a browser after the operation"
                },
                {
                    name: "--workspace",
                    description: "Document all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: "--no-deps",
                    description: "Don't build documentation for dependencies"
                },
                {
                    name: "--document-private-items",
                    description: "Document private items"
                },
                {
                    name: "--lib",
                    description: "Document only this package's library"
                },
                {
                    name: "--bins",
                    description: "Document all binaries"
                },
                {
                    name: "--examples",
                    description: "Document all examples"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ]
        },
        {
            name: "fetch",
            description: "Fetch dependencies of a package from the network",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--target",
                    description: "Fetch dependencies for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "fix",
            description: "Automatically fix lint warnings reported by rustc",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package(s) to fix",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the fixes",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Fix only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Fix only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Fix only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Fix only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Fix for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--workspace",
                    description: "Fix all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: "--lib",
                    description: "Fix only this package's library"
                },
                {
                    name: "--bins",
                    description: "Fix all binaries"
                },
                {
                    name: "--examples",
                    description: "Fix all examples"
                },
                {
                    name: "--tests",
                    description: "Fix all tests"
                },
                {
                    name: "--benches",
                    description: "Fix all benches"
                },
                {
                    name: "--all-targets",
                    description: "Fix all targets (default)"
                },
                {
                    name: ["-r", "--release"],
                    description: "Fix artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--broken-code",
                    description: "Fix code even if it already has compiler errors"
                },
                {
                    name: "--edition",
                    description: "Fix in preparation for the next edition"
                },
                {
                    name: "--edition-idioms",
                    description: "Fix warnings to migrate to the idioms of an edition"
                },
                {
                    name: "--allow-no-vcs",
                    description: "Fix code even if a VCS was not detected"
                },
                {
                    name: "--allow-dirty",
                    description: "Fix code even if the working directory is dirty"
                },
                {
                    name: "--allow-staged",
                    description: "Fix code even if the working directory has staged changes"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ]
        },
        {
            name: "generate-lockfile",
            description: "Generate the lockfile for a package",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "git-checkout",
            description: "This subcommand has been removed",
            options: [
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "init",
            description: "Create a new cargo package in an existing directory",
            options: [
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--vcs",
                    description: "Initialize a new repository for the given version control system (git, hg, pijul, or fossil) or do not initialize any version control at all (none), overriding a global configuration",
                    args: {
                        name: "vcs"
                    }
                },
                {
                    name: "--edition",
                    description: "Edition to set for the crate generated",
                    args: {
                        name: "edition"
                    }
                },
                {
                    name: "--name",
                    description: "Set the resulting package name, defaults to the directory name",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--bin",
                    description: "Use a binary (application) template [default]"
                },
                {
                    name: "--lib",
                    description: "Use a library template"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "path"
            }
        },
        {
            name: "install",
            description: "Install a Rust binary. Default location is $HOME/.cargo/bin",
            options: [
                {
                    name: "--version",
                    description: "Specify a version to install",
                    args: {
                        name: "version"
                    }
                },
                {
                    name: "--git",
                    description: "Git URL to install the specified crate from",
                    args: {
                        name: "git"
                    }
                },
                {
                    name: "--branch",
                    description: "Branch to use when installing from git",
                    args: {
                        name: "branch"
                    }
                },
                {
                    name: "--tag",
                    description: "Tag to use when installing from git",
                    args: {
                        name: "tag"
                    }
                },
                {
                    name: "--rev",
                    description: "Specific commit to use when installing from git",
                    args: {
                        name: "rev"
                    }
                },
                {
                    name: "--path",
                    description: "Filesystem path to local crate to install",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--profile",
                    description: "Install artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--bin",
                    description: "Install only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Install only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--root",
                    description: "Directory to install packages into",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: "--index",
                    description: "Registry index to install from",
                    args: {
                        name: "index"
                    }
                },
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--list",
                    description: "List all installed packages and their versions"
                },
                {
                    name: ["-f", "--force"],
                    description: "Force overwriting existing crates or binaries"
                },
                {
                    name: "--no-track",
                    description: "Do not save tracking information"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--debug",
                    description: "Build in debug mode instead of release mode"
                },
                {
                    name: "--bins",
                    description: "Install all binaries"
                },
                {
                    name: "--examples",
                    description: "Install all examples"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: {
                name: "crate"
            }
        },
        {
            name: "locate-project",
            description: "Print a JSON representation of a Cargo.toml file's location",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Output representation [possible values: json, plain]",
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--workspace",
                    description: "Locate Cargo.toml of the workspace root"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "login",
            description: "Save an api token from the registry locally. If token is not specified, it will be read from stdin",
            options: [
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "token"
            }
        },
        {
            name: "logout",
            description: "Remove an API token from the registry locally",
            options: [
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "metadata",
            description: "Output the resolved dependencies of a package, the concrete used versions including overrides, in machine-readable format",
            options: [
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--filter-platform",
                    description: "Only include resolve dependencies matching the given target-triple",
                    isRepeatable: true,
                    args: {
                        name: "filter-platform"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--format-version",
                    description: "Format version",
                    args: {
                        name: "format-version"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--no-deps",
                    description: "Output information only about the workspace members and don't fetch dependencies"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "new",
            description: "Create a new cargo package at <path>",
            options: [
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--vcs",
                    description: "Initialize a new repository for the given version control system (git, hg, pijul, or fossil) or do not initialize any version control at all (none), overriding a global configuration",
                    args: {
                        name: "vcs"
                    }
                },
                {
                    name: "--edition",
                    description: "Edition to set for the crate generated",
                    args: {
                        name: "edition"
                    }
                },
                {
                    name: "--name",
                    description: "Set the resulting package name, defaults to the directory name",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--bin",
                    description: "Use a binary (application) template [default]"
                },
                {
                    name: "--lib",
                    description: "Use a library template"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "path"
            }
        },
        {
            name: "owner",
            description: "Manage the owners of a crate on the registry",
            options: [
                {
                    name: ["-a", "--add"],
                    description: "Name of a user or team to invite as an owner",
                    isRepeatable: true,
                    args: {
                        name: "add"
                    }
                },
                {
                    name: ["-r", "--remove"],
                    description: "Name of a user or team to remove as an owner",
                    isRepeatable: true,
                    args: {
                        name: "remove"
                    }
                },
                {
                    name: "--index",
                    description: "Registry index to modify owners for",
                    args: {
                        name: "index"
                    }
                },
                {
                    name: "--token",
                    description: "API token to use when authenticating",
                    args: {
                        name: "token"
                    }
                },
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-l", "--list"],
                    description: "List owners of a crate"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "crate"
            }
        },
        {
            name: "package",
            description: "Assemble the local package into a distributable tarball",
            options: [
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package(s) to assemble",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Don't assemble specified packages",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-l", "--list"],
                    description: "Print files included in a package without making one"
                },
                {
                    name: "--no-verify",
                    description: "Don't verify the contents by building them"
                },
                {
                    name: "--no-metadata",
                    description: "Ignore warnings about a lack of human-usable metadata"
                },
                {
                    name: "--allow-dirty",
                    description: "Allow dirty working directories to be packaged"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--workspace",
                    description: "Assemble all packages in the workspace"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "pkgid",
            description: "Print a fully qualified package specification",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Argument to get the package ID specifier for",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "SPEC"
            }
        },
        {
            name: "publish",
            description: "Upload a package to the registry",
            options: [
                {
                    name: "--index",
                    description: "Registry index URL to upload the package to",
                    args: {
                        name: "index"
                    }
                },
                {
                    name: "--token",
                    description: "Token to use when uploading",
                    args: {
                        name: "token"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to publish",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--registry",
                    description: "Registry to publish to",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--no-verify",
                    description: "Don't verify the contents by building them"
                },
                {
                    name: "--allow-dirty",
                    description: "Allow dirty working directories to be packaged"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--dry-run",
                    description: "Perform all checks without uploading"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "read-manifest",
            description: "Print a JSON representation of a Cargo.toml manifest. Deprecated, use `cargo metadata --no-deps` instead",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "report",
            description: "Generate and display various kinds of reports",
            subcommands: [
                {
                    name: "future-incompatibilities",
                    description: "Reports any crates which will eventually stop compiling",
                    options: [
                        {
                            name: "--id",
                            description: "Identifier of the report generated by a Cargo command invocation",
                            args: {
                                name: "id"
                            }
                        },
                        {
                            name: ["-p", "--package"],
                            description: "Package to display a report for",
                            args: {
                                name: "package"
                            }
                        },
                        {
                            name: "--color",
                            description: "Coloring: auto, always, never",
                            args: {
                                name: "color"
                            }
                        },
                        {
                            name: "--config",
                            description: "Override a configuration value",
                            isRepeatable: true,
                            args: {
                                name: "config"
                            }
                        },
                        {
                            name: "-Z",
                            description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                            isRepeatable: true,
                            args: {
                                name: "unstable-features"
                            }
                        },
                        {
                            name: "--version",
                            description: "Print version information"
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        },
                        {
                            name: ["-v", "--verbose"],
                            description: "Use verbose output (-vv very verbose/build.rs output)",
                            isRepeatable: true
                        },
                        {
                            name: "--frozen",
                            description: "Require Cargo.lock and cache are up to date"
                        },
                        {
                            name: "--locked",
                            description: "Require Cargo.lock is up to date"
                        },
                        {
                            name: "--offline",
                            description: "Run without accessing the network"
                        }
                    ]
                },
                {
                    name: "help",
                    description: "Print this message or the help of the given subcommand(s)",
                    options: [
                        {
                            name: "--color",
                            description: "Coloring: auto, always, never",
                            args: {
                                name: "color"
                            }
                        },
                        {
                            name: "--config",
                            description: "Override a configuration value",
                            isRepeatable: true,
                            args: {
                                name: "config"
                            }
                        },
                        {
                            name: "-Z",
                            description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                            isRepeatable: true,
                            args: {
                                name: "unstable-features"
                            }
                        },
                        {
                            name: "--version",
                            description: "Print version information"
                        },
                        {
                            name: ["-h", "--help"],
                            description: "Print help information"
                        },
                        {
                            name: ["-v", "--verbose"],
                            description: "Use verbose output (-vv very verbose/build.rs output)",
                            isRepeatable: true
                        },
                        {
                            name: "--frozen",
                            description: "Require Cargo.lock and cache are up to date"
                        },
                        {
                            name: "--locked",
                            description: "Require Cargo.lock is up to date"
                        },
                        {
                            name: "--offline",
                            description: "Run without accessing the network"
                        }
                    ],
                    args: {
                        name: "subcommand"
                    }
                }
            ],
            options: [
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: ["run", "r"],
            description: "Run a binary or example of the local package",
            options: [
                {
                    name: "--bin",
                    description: "Name of the bin target to run",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Name of the example target to run",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package with the target to run",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: {
                name: "args"
            }
        },
        {
            name: "rustc",
            description: "Compile a package, and pass extra options to the compiler",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to build",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Build only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Build only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Build only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Build only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Target triple which compiles will be for",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--print",
                    description: "Output compiler information without compiling",
                    args: {
                        name: "print"
                    }
                },
                {
                    name: "--crate-type",
                    description: "Comma separated list of types of crates for the compiler to emit",
                    isRepeatable: true,
                    args: {
                        name: "crate-type"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--lib",
                    description: "Build only this package's library"
                },
                {
                    name: "--bins",
                    description: "Build all binaries"
                },
                {
                    name: "--examples",
                    description: "Build all examples"
                },
                {
                    name: "--tests",
                    description: "Build all tests"
                },
                {
                    name: "--benches",
                    description: "Build all benches"
                },
                {
                    name: "--all-targets",
                    description: "Build all targets"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--future-incompat-report",
                    description: "Outputs a future incompatibility report at the end of the build"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: {
                name: "args"
            }
        },
        {
            name: "rustdoc",
            description: "Build a package's documentation, using specified custom flags",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to document",
                    args: {
                        name: "package"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--bin",
                    description: "Build only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Build only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Build only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Build only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--open",
                    description: "Opens the docs in a browser after the operation"
                },
                {
                    name: "--lib",
                    description: "Build only this package's library"
                },
                {
                    name: "--bins",
                    description: "Build all binaries"
                },
                {
                    name: "--examples",
                    description: "Build all examples"
                },
                {
                    name: "--tests",
                    description: "Build all tests"
                },
                {
                    name: "--benches",
                    description: "Build all benches"
                },
                {
                    name: "--all-targets",
                    description: "Build all targets"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: {
                name: "args"
            }
        },
        {
            name: "search",
            description: "Search packages in crates.io",
            options: [
                {
                    name: "--index",
                    description: "Registry index URL to upload the package to",
                    args: {
                        name: "index"
                    }
                },
                {
                    name: "--limit",
                    description: "Limit the number of results (default: 10, max: 100)",
                    args: {
                        name: "limit"
                    }
                },
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "query"
            }
        },
        {
            name: ["test", "t"],
            description: "Execute all unit and integration tests and build examples of a local package",
            options: [
                {
                    name: "--bin",
                    description: "Test only the specified binary",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--example",
                    description: "Test only the specified example",
                    isRepeatable: true,
                    args: {
                        name: "example"
                    }
                },
                {
                    name: "--test",
                    description: "Test only the specified test target",
                    isRepeatable: true,
                    args: {
                        name: "test"
                    }
                },
                {
                    name: "--bench",
                    description: "Test only the specified bench target",
                    isRepeatable: true,
                    args: {
                        name: "bench"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to run tests for",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude packages from the test",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: ["-j", "--jobs"],
                    description: "Number of parallel jobs, defaults to # of CPUs",
                    args: {
                        name: "jobs"
                    }
                },
                {
                    name: "--profile",
                    description: "Build artifacts with the specified profile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Build for the target triple",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: "--target-dir",
                    description: "Directory for all generated artifacts",
                    args: {
                        name: "target-dir"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--message-format",
                    description: "Error format",
                    isRepeatable: true,
                    args: {
                        name: "message-format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Display one character per test instead of one line"
                },
                {
                    name: "--lib",
                    description: "Test only this package's library unit tests"
                },
                {
                    name: "--bins",
                    description: "Test all binaries"
                },
                {
                    name: "--examples",
                    description: "Test all examples"
                },
                {
                    name: "--tests",
                    description: "Test all tests"
                },
                {
                    name: "--benches",
                    description: "Test all benches"
                },
                {
                    name: "--all-targets",
                    description: "Test all targets"
                },
                {
                    name: "--doc",
                    description: "Test only this library's documentation"
                },
                {
                    name: "--no-run",
                    description: "Compile, but don't run tests"
                },
                {
                    name: "--no-fail-fast",
                    description: "Run all tests regardless of failure"
                },
                {
                    name: "--workspace",
                    description: "Test all packages in the workspace"
                },
                {
                    name: "--all",
                    description: "Alias for --workspace (deprecated)"
                },
                {
                    name: ["-r", "--release"],
                    description: "Build artifacts in release mode, with optimizations"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--ignore-rust-version",
                    description: "Ignore `rust-version` specification in packages"
                },
                {
                    name: "--unit-graph",
                    description: "Output build graph in JSON (unstable)"
                },
                {
                    name: "--future-incompat-report",
                    description: "Outputs a future incompatibility report at the end of the build"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: "--timings",
                    description: "Timing output formats (unstable)"
                }
            ],
            args: [
                {
                    name: "TESTNAME"
                },
                {
                    name: "args"
                }
            ]
        },
        {
            name: "tree",
            description: "Display a tree visualization of a dependency graph",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to be used as the root of the tree",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--exclude",
                    description: "Exclude specific workspace members",
                    isRepeatable: true,
                    args: {
                        name: "exclude"
                    }
                },
                {
                    name: "--features",
                    description: "Space or comma separated list of features to activate",
                    isRepeatable: true,
                    args: {
                        name: "features"
                    }
                },
                {
                    name: "--target",
                    description: "Filter dependencies matching the given target-triple (default host platform). Pass `all` to include all targets",
                    isRepeatable: true,
                    args: {
                        name: "target"
                    }
                },
                {
                    name: ["-e", "--edges"],
                    description: "The kinds of dependencies to display (features, normal, build, dev, all, no-normal, no-build, no-dev, no-proc-macro)",
                    isRepeatable: true,
                    args: {
                        name: "edges"
                    }
                },
                {
                    name: ["-i", "--invert"],
                    description: "Invert the tree direction and focus on the given package",
                    isRepeatable: true,
                    args: {
                        name: "invert"
                    }
                },
                {
                    name: "--prune",
                    description: "Prune the given package from the display of the dependency tree",
                    isRepeatable: true,
                    args: {
                        name: "prune"
                    }
                },
                {
                    name: "--depth",
                    description: "Maximum display depth of the dependency tree",
                    args: {
                        name: "depth"
                    }
                },
                {
                    name: "--prefix",
                    description: "Change the prefix (indentation) of how each entry is displayed",
                    args: {
                        name: "prefix"
                    }
                },
                {
                    name: "--charset",
                    description: "Character set to use in output: utf8, ascii",
                    args: {
                        name: "charset"
                    }
                },
                {
                    name: ["-f", "--format"],
                    description: "Format string used for printing dependencies",
                    args: {
                        name: "format"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--workspace",
                    description: "Display the tree for all packages in the workspace"
                },
                {
                    name: ["-a", "--all"]
                },
                {
                    name: "--all-targets"
                },
                {
                    name: "--all-features",
                    description: "Activate all available features"
                },
                {
                    name: "--no-default-features",
                    description: "Do not activate the `default` feature"
                },
                {
                    name: "--no-dev-dependencies"
                },
                {
                    name: "--no-indent"
                },
                {
                    name: "--prefix-depth"
                },
                {
                    name: "--no-dedupe",
                    description: "Do not de-duplicate (repeats all shared dependencies)"
                },
                {
                    name: ["-d", "--duplicates"],
                    description: "Show only dependencies which come in multiple versions (implies -i)"
                },
                {
                    name: ["-V", "--version"]
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "uninstall",
            description: "Remove a Rust binary",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to uninstall",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--bin",
                    description: "Only uninstall the binary NAME",
                    isRepeatable: true,
                    args: {
                        name: "bin"
                    }
                },
                {
                    name: "--root",
                    description: "Directory to uninstall packages from",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "SPEC"
            }
        },
        {
            name: "update",
            description: "Update dependencies as recorded in the local lock file",
            options: [
                {
                    name: ["-p", "--package"],
                    description: "Package to update",
                    isRepeatable: true,
                    args: {
                        name: "package"
                    }
                },
                {
                    name: "--precise",
                    description: "Update a single dependency to exactly PRECISE when used with -p",
                    args: {
                        name: "precise"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-w", "--workspace"],
                    description: "Only update the workspace packages"
                },
                {
                    name: "--aggressive",
                    description: "Force updating all dependencies of SPEC as well when used with -p"
                },
                {
                    name: "--dry-run",
                    description: "Don't actually write the lockfile"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "vendor",
            description: "Vendor all dependencies for a project locally",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: ["-s", "--sync"],
                    description: "Additional `Cargo.toml` to sync and vendor",
                    isRepeatable: true,
                    args: {
                        name: "tomls"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--no-delete",
                    description: "Don't delete older crates in the vendor directory"
                },
                {
                    name: "--respect-source-config",
                    description: "Respect `[source]` config in `.cargo/config`",
                    isRepeatable: true
                },
                {
                    name: "--versioned-dirs",
                    description: "Always include version in subdir name"
                },
                {
                    name: "--no-merge-sources"
                },
                {
                    name: "--relative-path"
                },
                {
                    name: "--only-git-deps"
                },
                {
                    name: "--disallow-duplicates"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "path"
            }
        },
        {
            name: "verify-project",
            description: "Check correctness of crate manifest",
            options: [
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml",
                    args: {
                        name: "manifest-path"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "version",
            description: "Show version information",
            options: [
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ]
        },
        {
            name: "yank",
            description: "Remove a pushed crate from the index",
            options: [
                {
                    name: "--vers",
                    description: "The version to yank or un-yank",
                    args: {
                        name: "vers"
                    }
                },
                {
                    name: "--index",
                    description: "Registry index to yank from",
                    args: {
                        name: "index"
                    }
                },
                {
                    name: "--token",
                    description: "API token to use when authenticating",
                    args: {
                        name: "token"
                    }
                },
                {
                    name: "--registry",
                    description: "Registry to use",
                    args: {
                        name: "registry"
                    }
                },
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--undo",
                    description: "Undo a yank, putting a version back into the index"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "crate"
            }
        },
        {
            name: "help",
            description: "Print this message or the help of the given subcommand(s)",
            options: [
                {
                    name: "--color",
                    description: "Coloring: auto, always, never",
                    args: {
                        name: "color"
                    }
                },
                {
                    name: "--config",
                    description: "Override a configuration value",
                    isRepeatable: true,
                    args: {
                        name: "config"
                    }
                },
                {
                    name: "-Z",
                    description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
                    isRepeatable: true,
                    args: {
                        name: "unstable-features"
                    }
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output (-vv very verbose/build.rs output)",
                    isRepeatable: true
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                }
            ],
            args: {
                name: "subcommand"
            }
        },
        {
            name: "add",
            description: "Add dependencies to a Cargo.toml manifest file",
            options: [
                {
                    name: "--no-default-features",
                    description: "Disable the default features"
                },
                {
                    name: "--default-features",
                    description: "Re-enable the default features"
                },
                {
                    name: ["-F", "--features"],
                    description: "Space or comma separated list of features to activate"
                },
                {
                    name: "--optional",
                    description: "Mark the dependency as optional"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output"
                },
                {
                    name: "--no-optional",
                    description: "Mark the dependency as required"
                },
                {
                    name: "--color",
                    args: {
                        name: "WHEN"
                    }
                },
                {
                    name: "--rename",
                    description: "Rename the dependency",
                    args: {
                        name: "NAME"
                    }
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to modify",
                    args: {
                        name: "SPEC"
                    }
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--dry-run",
                    description: "Don't actually write the manifest"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                },
                {
                    name: "--path",
                    description: "Filesystem path to local crate to add",
                    args: {
                        name: "PATH"
                    }
                },
                {
                    name: "--git",
                    description: "Git repository location",
                    args: {
                        name: "URI"
                    }
                },
                {
                    name: "--branch",
                    description: "Git branch to download the crate from",
                    args: {
                        name: "BRANCH"
                    }
                },
                {
                    name: "--tag",
                    description: "Git tag to download the crate from",
                    args: {
                        name: "TAG"
                    }
                },
                {
                    name: "--rev",
                    description: "Git reference to download the crate from",
                    args: {
                        name: "REV"
                    }
                },
                {
                    name: "--registry",
                    description: "Package registry for this dependency",
                    args: {
                        name: "NAME"
                    }
                },
                {
                    name: "--dev",
                    description: "Add as development dependency"
                },
                {
                    name: "--build",
                    description: "Add as build dependency"
                },
                {
                    name: "--target",
                    description: "Add as dependency to the given target platform",
                    args: {
                        name: "TARGET"
                    }
                }
            ],
            args: {
                name: "DEP_ID"
            }
        },
        {
            name: ["remove", "rm"],
            description: "Remove dependencies from a Cargo.toml manifest file",
            options: [
                {
                    name: "--dev",
                    description: "Remove as development dependency"
                },
                {
                    name: "--build",
                    description: "Remove as build dependency"
                },
                {
                    name: "--target",
                    description: "Remove as dependency to the given target platform",
                    args: {
                        name: "TARGET"
                    }
                },
                {
                    name: ["-p", "--package"],
                    description: "Package to remove from",
                    args: {
                        name: "SPEC"
                    }
                },
                {
                    name: "--manifest-path",
                    description: "Path to Cargo.toml"
                },
                {
                    name: ["-q", "--quiet"],
                    description: "Do not print cargo log messages"
                },
                {
                    name: "--dry-run",
                    description: "Don't actually write the manifest"
                },
                {
                    name: ["-v", "--verbose"],
                    description: "Use verbose output"
                },
                {
                    name: "--color",
                    args: {
                        name: "WHEN"
                    }
                },
                {
                    name: "--frozen",
                    description: "Require Cargo.lock and cache are up to date"
                },
                {
                    name: "--locked",
                    description: "Require Cargo.lock is up to date"
                },
                {
                    name: "--offline",
                    description: "Run without accessing the network"
                },
                {
                    name: ["-h", "--help"],
                    description: "Print help information"
                }
            ],
            args: {
                name: "DEP_ID"
            }
        }
    ],
    options: [
        {
            name: "--explain",
            description: "Run `rustc --explain CODE`",
            args: {
                name: "explain"
            }
        },
        {
            name: "--color",
            description: "Coloring: auto, always, never",
            args: {
                name: "color"
            }
        },
        {
            name: "--config",
            description: "Override a configuration value",
            isRepeatable: true,
            args: {
                name: "config"
            }
        },
        {
            name: "-Z",
            description: "Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details",
            isRepeatable: true,
            args: {
                name: "unstable-features"
            }
        },
        {
            name: ["-h", "--help"],
            description: "Print help information"
        },
        {
            name: ["-V", "--version"],
            description: "Print version info and exit"
        },
        {
            name: "--list",
            description: "List installed commands"
        },
        {
            name: ["-v", "--verbose"],
            description: "Use verbose output (-vv very verbose/build.rs output)",
            isRepeatable: true
        },
        {
            name: ["-q", "--quiet"],
            description: "Do not print cargo log messages"
        },
        {
            name: "--frozen",
            description: "Require Cargo.lock and cache are up to date"
        },
        {
            name: "--locked",
            description: "Require Cargo.lock is up to date"
        },
        {
            name: "--offline",
            description: "Run without accessing the network"
        }
    ]
});
export default completionSpec();
