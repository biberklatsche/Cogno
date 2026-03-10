import { keyValueList, valueList } from "@fig/autocomplete-generators";
import type { CommandSpec, Generator, OptionSpec } from "../spec.types";
const icon = "data:image/png;base64,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";
const ignoreExtensions = new Set(["", "sample", "env"]);
const extensions: Generator["custom"] = async (_, executeShellCommand) => {
    const { stdout } = await executeShellCommand({
        command: "bash",
        args: [
            "-c",
            "find . -depth 3 -type f -name '*.*' -not -path '*/node_modules/*' | sed 's/.*\\.//' | sort -u"
        ],
    });
    const lines = stdout.trim().split("\n");
    return lines
        .filter((line) => !ignoreExtensions.has(line))
        .map((line) => ({ name: "." + line }));
};
const spec: CommandSpec = {
    name: "esbuild",
    description: "An extremely fast JavaScript bundler",
    options: ([
        // Simple options:
        {
            name: "--bundle",
            description: "Bundle all dependencies into the output files"
        },
        {
            name: "--define",
            description: "Replace variable names with a literal value, eg. --define:DEBUG=true",
            args: { name: "name=value" }
        },
        {
            name: "--external",
            description: "Exclude modules from the build",
            args: { name: "module specifier" }
        },
        {
            name: "--format",
            description: "The output format",
            args: { name: "format" }
        },
        {
            name: "--loader",
            description: "For a given file extension, specify a loader",
            args: {
                name: "loaders"
            }
        },
        {
            name: "--minify",
            description: "Minify the output (sets all the --minify-* options)"
        },
        {
            name: "--outdir",
            description: "The output directory for multiple entrypoints",
            args: { name: "path" }
        },
        {
            name: "--outfile",
            description: "The output file for one entrypoint",
            args: { name: "path" }
        },
        {
            name: "--platform",
            description: "The platform target",
            args: { name: "name" }
        },
        {
            name: "--serve",
            description: "Start a local HTTP server on this host:port",
            args: { name: "[address:]port" }
        },
        {
            name: "--splitting",
            description: "Enable code splitting"
        },
        {
            name: "--target",
            description: "Set the environment target. Can be a particular ES version or browser version, eg. chrome101",
            args: {
                name: "target"
            }
        },
        {
            name: "--watch",
            description: "Rebuild on file system changes",
            args: {
                name: "forever"
            }
        },
        // Advanced options:
        {
            name: "--allow-overwrite",
            description: "Allow output files to overwrite input files"
        },
        {
            name: "--analyze",
            description: "Print a report about the contents of the bundle",
            args: { name: "verbose" }
        },
        {
            name: "--asset-names",
            description: "Path template for 'file' loader files",
            args: { name: "template" }
        },
        {
            name: "--banner",
            description: "Text to be prepended to each output file type",
            args: {
                name: "ext=text[,ext=text...]"
            }
        },
        {
            name: "--charset",
            description: "Use UTF-8 instead of escaped codepoints in ASCII"
        },
        {
            name: "--chunk-names",
            description: "Path template to use for code splitting chunks",
            args: { name: "template" }
        },
        {
            name: "--color",
            description: "Force use of terminal colors",
            args: { name: "enabled" }
        },
        {
            name: "--drop",
            description: "Remove certain constructs"
        },
        {
            name: "--entry-names",
            description: "Path template to use for entry point output paths",
            args: { name: "template" }
        },
        {
            name: "--footer",
            description: "Text to be appended to each file type",
            args: {
                name: "ext=text"
            }
        },
        {
            name: "--global-name",
            description: "The name of the global if using --format=iife",
            args: { name: "name" }
        },
        {
            name: "--ignore-annotations",
            description: "Enable this to work with packages that have incorrect tree-shaking annotations"
        },
        {
            name: "--inject",
            description: "Import the file into all input files, automatically replace matching globals",
            args: { name: "import" }
        },
        {
            name: "--jsx-factory",
            description: "What to use for the JSX factory",
            args: {
                name: "factory"
            }
        },
        {
            name: "--jsx-fragment",
            description: "What to use for the JS Fragment factory",
            args: { name: "fragment" }
        },
        {
            name: "--jsx",
            description: "Preserve JSX instead of transforming"
        },
        {
            name: "--jsx-dev",
            description: "Toggles development mode for the automatic runtime"
        },
        {
            name: "--jsx-import-source",
            description: "Overrides the root import for runtime functions (default: react)",
            args: { name: "source" }
        },
        {
            name: "--keep-names",
            description: "Preserve 'name' on functions and classes"
        },
        {
            name: "--legal-comments",
            description: "Where to place legal comments",
            args: {
                name: "location"
            }
        },
        {
            name: "--log-level",
            description: "Set the log level",
            args: {
                name: "level"
            }
        },
        {
            name: "--log-limit",
            description: "Maximum message count, 0 to disable",
            args: { name: "count" }
        },
        {
            name: "--log-override",
            description: "For a particular identifier, set the log level",
            args: {
                name: "identifier:level"
            }
        },
        {
            name: "--main-fields",
            description: "Override the main file order in package.json",
            args: { name: "field order" }
        },
        {
            name: "--mangle-cache",
            description: "Save 'mangle props' decisions to a JSON file",
            args: {
                name: "path"
            }
        },
        {
            name: "--mangle-props",
            description: "Rename all properties matching a regular expression",
            args: { name: "regex" }
        },
        {
            name: "--mangle-quoted",
            description: "Enable mangling (renaming) quoted properties",
            args: { name: "status" }
        },
        {
            name: "--metafile",
            description: "Write metadata about the build to a JSON file",
            args: {
                name: "path"
            }
        },
        {
            name: "--minify-whitespace",
            description: "Remove unnecessary whitespace in output files"
        },
        {
            name: "--minify-identifiers",
            description: "Shorten identifiers in output files"
        },
        {
            name: "--minify-syntax",
            description: "Use equivalent but shorter syntax in output files"
        },
        {
            name: "--out-extension",
            description: "Use a custom output extension for each extension",
            args: {
                name: "ext=new"
            }
        },
        {
            name: "--outbase",
            description: "Base path used to determine entrypoint output paths, for multiple entrypoints",
            args: { name: "path" }
        },
        {
            name: "--preserve-symlinks",
            description: "Disable symlink resolution"
        },
        {
            name: "--public-path",
            description: "Set the base URL for the 'file' loader",
            args: { name: "path" }
        },
        {
            name: "--pure",
            description: "Mark the name as a pure function for tree shaking",
            args: { name: "name" }
        },
        {
            name: "--reserve-props",
            description: "Do not mangle these properties",
            args: { name: "properties" }
        },
        {
            name: "--resolve-extensions",
            description: "Comma-separated list of implicit extensions",
            args: {
                name: "extensions"
            }
        },
        {
            name: "--servedir",
            description: "What to serve in addition to the generated output files",
            args: { name: "path" }
        },
        {
            name: "--source-root",
            description: "Set the sourceRoot field in generated source maps",
            args: { name: "URL" }
        },
        {
            name: "--sourcefile",
            description: "Set the source file for the source map if there's no file name to use",
            args: { name: "name" }
        },
        {
            name: "--sourcemap",
            description: "Generate source maps?",
            args: {
                name: "options"
            }
        },
        {
            name: "--sources-content",
            description: "Omit the sourcesContent field in generated source maps"
        },
        {
            name: "--supported",
            description: "Consider a given syntax to be supported",
            args: {
                name: "syntax=status"
            }
        },
        {
            name: "--tree-shaking",
            description: "Force tree shaking on or off",
            args: { name: "status" }
        },
        {
            name: "--tsconfig",
            description: "Use this TypeScript config instead of the default",
            args: { name: "path" }
        },
        {
            name: "--version",
            description: "Print the current version and exit"
        }
    ] as OptionSpec[]).map((option) => ({ ...option, icon }))
};
export default spec;
