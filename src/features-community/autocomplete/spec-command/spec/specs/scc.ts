import type { CommandSpec, Suggestion } from "../spec.types";
import { KeyValueSuggestions, keyValueList, valueList } from "@fig/autocomplete-generators";
/** The output of processing `scc --languages` */
interface SccLanguages {
    /** A map of file extension to language name. */
    extensions: Record<string, string>;
    /** An array of language names. */
    languages: string[];
}
/** Process the output of `scc --languages`. */
function processSccLanguages(out: string): SccLanguages {
    const extensions: Record<string, string> = {};
    const languages: string[] = [];
    // All lines are in the form of 'Languages (ext1,ext2,...)'
    const matches = out.matchAll(/^(.*) \((.*)\)$/gm);
    for (const match of matches) {
        const language = match[1];
        languages.push(language);
        const extensionMatches = match[2].split(",");
        for (const extension of extensionMatches) {
            extensions[extension] = language;
        }
    }
    return { extensions, languages };
}
const generateLanguages: KeyValueSuggestions = async (_, executeShellCommand) => {
    const { stdout } = await executeShellCommand({
        command: "scc",
        // eslint-disable-next-line @withfig/fig-linter/no-useless-arrays
        args: ["--language"],
    });
    const { languages } = processSccLanguages(stdout);
    return languages.map((language) => ({ name: language }));
};
/** The formats that SCC can output. */
const suggestOutputFormats: Suggestion[] = [
    { name: "tabular", icon: "fig://icon?type=string" },
    { name: "wide", icon: "fig://icon?type=string" },
    { name: "json", icon: "fig://icon?type=string" },
    { name: "csv", icon: "fig://icon?type=string" },
    { name: "csv-stream", icon: "fig://icon?type=string" },
    { name: "cloc-yaml", icon: "fig://icon?type=string" },
    { name: "html", icon: "fig://icon?type=string" },
    { name: "html-table", icon: "fig://icon?type=string" },
    { name: "sql", icon: "fig://icon?type=string" },
    { name: "sql-insert", icon: "fig://icon?type=string" }
];
/**
 * Get the size of the Drivemaker's Kilobyte. It shrinks by 4 bytes each year,
 * for marketing reasons.
 *
 * @see https://xkcd.com/394
 *
 * Test cases:
 * ```
 * getDriveKB(1984) === 1024;
 * getDriveKB(2013) === 908;
 * ```
 */
function getDriveKB(year: number): number {
    // What's the significance of 1984? That's Randall's birth year. Possibly a
    // coincidence, but he does love hiding little easter eggs in his comics.
    return 1024 - (year - 1984) * 4;
}
/** The current size of the Drivemaker's Kilobyte */
const driveKB = getDriveKB(new Date().getFullYear());
const completionSpec: CommandSpec = {
    name: "scc",
    description: "Sloc, Cloc and Code. Count lines of code in a directory with complexity estimation",
    options: [
        {
            name: "--avg-wage",
            description: "Average salary value used for COCOMO calculations",
            args: {
                name: "int"
            }
        },
        {
            name: "--binary",
            description: "Disable binary file detection"
        },
        {
            name: "--by-file",
            description: "Display output for every file"
        },
        {
            name: "--ci",
            description: "Enable CI output settings where stdout is ASCII"
        },
        {
            name: "--cocomo-project-type",
            description: 'Change the COCOMO model type (allows custom models, eg. "name,1,1,1,1")',
            args: {
                name: "string"
            }
        },
        {
            name: "--count-as",
            description: "Count a file extension as a language (comma-separated key:value list, eg. jst:js,tpl:Markdown)",
            args: {
                name: "string"
            }
        },
        {
            name: "--debug",
            description: "Enable debug output"
        },
        {
            name: "--exclude-dir",
            description: "Directories to exclude",
            args: {
                name: "strings"
            }
        },
        {
            name: "--file-gc-count",
            description: "Number of files to parse before turning the GC on",
            args: {
                name: "int"
            }
        },
        {
            name: ["-f", "--format"],
            description: "Set output format",
            args: {
                name: "string"
            }
        },
        {
            name: "--format-multi",
            description: "Multiple outputs with different formats (comma-separated key:value list, eg. tabular:stdout,csv:scc.csv)",
            args: {
                name: "string"
            }
        },
        {
            name: "--gen",
            description: "Identify generated files"
        },
        {
            name: "--generated-markers",
            description: "Identify generated files by the presence of a string (comma-separated list)",
            args: {
                name: "strings"
            }
        },
        {
            name: ["-h", "--help"],
            description: "Help for scc"
        },
        {
            name: ["-i", "--include-ext"],
            description: "Limit to these file extensions (comma-separated list)",
            args: {
                name: "strings"
            }
        },
        {
            name: "--include-symlinks",
            description: "Count symbolic links"
        },
        {
            name: ["-l", "--languages"],
            description: "Print supported languages and extensions"
        },
        {
            name: "--large-byte-count",
            description: "Number of bytes a file can contain before being omitted",
            args: {
                name: "int"
            }
        },
        {
            name: "--large-line-count",
            description: "Number of lines a file can contain before being omitted",
            args: {
                name: "int"
            }
        },
        {
            name: "--min",
            description: "Identify minified files"
        },
        {
            name: ["-z", "--min-gen"],
            description: "Identify minified or generated files"
        },
        {
            name: "--min-gen-line-length",
            description: "Number of bytes per average line for file to be considered minified or generated",
            args: {
                name: "int"
            }
        },
        {
            name: "--no-cocomo",
            description: "Skip COCOMO calculation"
        },
        {
            name: ["-c", "--no-complexity"],
            description: "Skip code complexity calculation"
        },
        {
            name: ["-d", "--no-duplicates"],
            description: "Remove duplicate files from stats and output"
        },
        {
            name: "--no-gen",
            description: "Ignore generated files in output (implies --gen)"
        },
        {
            name: "--no-gitignore",
            description: "Disables .gitignore file logic"
        },
        {
            name: "--no-ignore",
            description: "Disables .ignore file logic"
        },
        {
            name: "--no-large",
            description: "Ignore files over certain byte and line size set by --max-line-count and --max-byte-count"
        },
        {
            name: "--no-min",
            description: "Ignore minified files in output (implies --min)"
        },
        {
            name: "--no-min-gen",
            description: "Ignore minified or generated files in output (implies --min-gen)"
        },
        {
            name: "--no-size",
            description: "Remove size calculation output"
        },
        {
            name: ["-M", "--not-match"],
            description: "Ignore files and directories matching regular expression",
            args: {
                name: "regex"
            }
        },
        {
            name: ["-o", "--output"],
            description: "Output filename (defaults to stdout if not provided)",
            args: {
                name: "string"
            }
        },
        {
            name: "--remap-all",
            description: 'Inspect every file and set its type by checking for a string (comma-separated key:value list, eg. "-*- C++ -*-":"C Header")',
            args: {
                name: "string"
            }
        },
        {
            name: "--remap-unknown",
            description: 'Inspect files of unknown type and set its type by checking for a string (comma-separated key:value list, eg. "-*- C++ -*-":"C Header")',
            args: {
                name: "string"
            }
        },
        {
            name: "--size-unit",
            description: "Set the unit used for file size output",
            args: {
                name: "string",
                description: "See https://xkcd.com/394/"
            }
        },
        {
            name: ["-s", "--sort"],
            description: "Column to sort by",
            args: {
                name: "string"
            }
        },
        {
            name: "--sql-project",
            description: "Use supplied name as the project identifier for the current run. Only valid with the '--format sql' or '--format sql-insert' option",
            args: {
                name: "string"
            }
        },
        {
            name: ["-t", "--trace"],
            description: "Enable trace output (not recommended when processing multiple files)"
        },
        {
            name: ["-v", "--verbose"],
            description: "Verbose output"
        },
        {
            name: "--version",
            description: "Version for scc"
        },
        {
            name: ["-w", "--wide"],
            description: "Wider output with additional statistics (implies --complexity)"
        }
    ]
};
export default completionSpec;
