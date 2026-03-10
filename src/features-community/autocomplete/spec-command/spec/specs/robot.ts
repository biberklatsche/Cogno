import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec, Generator, Suggestion } from "../spec.types";
const tagsGenerator: Generator = {
    script: [
        "bash",
        "-c",
        'for i in $(find -E . -regex ".*.robot" -type f); do cat -s $i ; done'
    ],
    postProcess: (out) => {
        // find all lines with tags
        // regex: line that starts with 2+ spaces, than '[Tags]  ' and words
        const iter = out.matchAll(/(?:^\s\s+\[Tags\])\s\s+(\w+ *)*(?!.\#.*)/gm);
        const seen: Set<string> = new Set();
        const suggestions: Suggestion[] = [];
        for (const [line] of iter) {
            // original line: "   [Tags]  first tag  dev tag    some tag   "
            // desired line: ["first tag", "dev tag", "some tag"]
            for (const tag of line.trim().substring(6).trim().split(/\s\s+/)) {
                if (seen.has(tag))
                    continue;
                seen.add(tag);
                suggestions.push({
                    name: tag,
                    description: "Tag",
                    icon: "🏷",
                });
            }
        }
        return suggestions;
    },
};
const variablesGenerator: Generator = {
    trigger: ":",
    custom: async (tokens, executeShellCommand) => {
        const finalToken = tokens[tokens.length - 1];
        const isKey = !finalToken.includes(":");
        if (!isKey)
            return [];
        const { stdout } = await executeShellCommand({
            command: "bash",
            args: [
                "-c",
                'for i in $(find -E . -regex ".*.(robot|resource)" -type f); do cat -s $i ; done'
            ],
        });
        const iter = stdout.matchAll(/^\$\{(.*?)\}/gm);
        return [...iter]
            .map((item) => item[1])
            .map((variable) => ({
            name: variable,
            description: "Variable",
        }));
    },
};
const testCasesGenerator: Generator = {
    script: [
        "bash",
        "-c",
        'for i in $(find -E . -regex ".*.robot" -type f); do cat -s $i ; done'
    ],
    postProcess: (out) => {
        // find all parts of the code with test cases
        // regex: everything after '***Test Cases***' until '***???***')
        const iter = out.matchAll(/(?:\*{3} ?Test Cases ?\*{3})([\S\s]*)(?:\*{3}(\w+\s?)+\*{3})*/gim);
        const seen: Set<string> = new Set();
        const suggestions: Suggestion[] = [];
        // go through ***Test Cases** blocks
        for (const [_, block] of iter) {
            // get every test case name
            // regex: word/s at the start of a line until '#'
            const lines = block.matchAll(/^(\w+( |-)*)+(?!.\#.*)(?!.\#.*)/gm);
            // go through all the test cases names found
            for (let [testCase] of lines) {
                testCase = testCase.trim();
                // validate if the test case name isn't divided by more than one space
                if (testCase.search(/\s\s+/) != -1)
                    continue;
                if (seen.has(testCase))
                    continue;
                seen.add(testCase);
                suggestions.push({
                    name: testCase,
                    description: "Test case",
                });
            }
        }
        return suggestions;
    },
};
const completionSpec: CommandSpec = {
    name: "robot",
    description: "CLI for running Robot Framework automation tests",
    options: [
        {
            name: ["-h", "-?", "--help"],
            description: "Print usage instructions"
        },
        {
            name: "--rpa",
            description: 'Turn on the generic automation mode. Mainly affects terminology so that "test" is replaced with "task" in logs and reports'
        },
        {
            name: ["-F", "--extension"],
            description: "Parse only files with this extension when executing a directory",
            args: {
                name: "extension",
                description: "File extensions divided by colon"
            }
        },
        {
            name: ["-N", "--name"],
            description: "Set a name of the top level suite",
            args: {
                name: "name"
            }
        },
        {
            name: ["-D", "--doc"],
            description: "Set a documentation of the top level suite"
        },
        {
            name: ["-M", "--metadata"],
            description: "Set metadata of the top level suite",
            args: {
                name: "name:value"
            }
        },
        {
            name: ["-G", "--settag"],
            description: "Sets given tag to all executed tests",
            args: {
                name: "tag"
            }
        },
        {
            name: ["-t", "--test"],
            description: "Select tests by name or by long name containing also parent suite name like `Parent.Test`",
            args: {
                name: "name"
            }
        },
        {
            name: "--task",
            description: "Alias to --test. Especially applicable with --rpa",
            args: {
                name: "name"
            }
        },
        {
            name: ["-s", "--suite"],
            description: "Select suites by name",
            args: {
                name: "name"
            }
        },
        {
            name: ["-i", "--include"],
            description: "Select test cases by tag",
            args: {
                name: "tag"
            }
        },
        {
            name: ["-e", "--exclude"],
            description: "Select test cases not to run by tag",
            args: {
                name: "tag"
            }
        },
        {
            name: ["-R", "--rerunfailed"],
            description: "Select failed tests from an earlier output file to be re-executed",
            args: {
                name: "output file"
            }
        },
        {
            name: ["-S", "--rerunfailedsuites"],
            description: "Select failed suites from an earlier output file to be re-executed",
            args: {
                name: "output file"
            }
        },
        {
            name: "--runemptysuite",
            description: "Executes suite even if it contains no tests"
        },
        {
            name: "--skip",
            description: "Tests having given tag will be skipped",
            args: {
                name: "tag"
            }
        },
        {
            name: "--skiponfailure",
            description: "Tests having given tag will be skipped if they fail",
            args: {
                name: "tag"
            }
        },
        {
            name: ["-v", "--variable"],
            description: "Set variables in the test data",
            args: {
                name: "variable"
            }
        },
        {
            name: ["-V", "--variablefile"],
            description: "Python or YAML file file to read variables from",
            args: {
                name: "file"
            }
        },
        {
            name: ["-d", "--outputdir"],
            description: "Where to create output files. The default is the directory where tests are run from",
            args: {
                name: "directory"
            }
        },
        {
            name: ["-o", "--output"],
            description: "XML output file relative to --outputdir unless given as an absolute path. Default: output.xml",
            args: {
                name: "file"
            }
        },
        {
            name: ["-l", "--log"],
            description: "HTML log file. Can be disabled by giving a special value `NONE`. Default: log.html",
            args: {
                name: "file"
            }
        },
        {
            name: ["-r", "--report"],
            description: "HTML report file. Can be disabled with `NONE` similarly as --log. Default: report.html",
            args: {
                name: "file"
            }
        },
        {
            name: ["-x", "--xunit"],
            description: "XUnit compatible result file. Not created unless this option is specified",
            args: {
                name: "file"
            }
        },
        {
            name: ["-b", "--debugfile"],
            description: "Debug file written during execution. Not created unless this option is specified",
            args: {
                name: "file"
            }
        },
        {
            name: ["-T", "--timestampoutputs"],
            description: "Adds timestamp in a format `YYYYMMDD-hhmmss` to all generated output files between their basename and extension"
        },
        {
            name: "--splitlog",
            description: "Split the log file into smaller pieces that open in browsers transparently"
        },
        {
            name: "--logtitle",
            description: "Title for the generated log file. The default title is `<SuiteName> Log.`",
            args: {
                name: "title"
            }
        },
        {
            name: "--reporttitle",
            description: "Title for the generated report file. The default title is `<SuiteName> Report`",
            args: {
                name: "title"
            }
        },
        {
            name: "--reportbackground",
            description: "Background colors to use in the report file. Given in format `passed:failed:skipped` where the `:skipped` part can be omitted",
            args: {
                name: "colors"
            }
        },
        {
            name: "--maxerrorlines",
            description: "Maximum number of error message lines to show in report when tests fail. Default is 40, minimum is 10 and `NONE` can be used to show the full message",
            args: {
                name: "lines"
            }
        },
        {
            name: "--maxassignlength",
            description: "Maximum number of characters to show in log when variables are assigned. Zero or negative values can be used to avoid showing assigned values at all. Default is 200",
            args: {
                name: "characters"
            }
        },
        {
            name: ["-L", "--loglevel"],
            description: "Threshold level for logging",
            args: {
                name: "level"
            }
        },
        {
            name: "--suitestatlevel",
            description: "How many levels to show in `Statistics by Suite` in log and report",
            args: {
                name: "level"
            }
        },
        {
            name: "--tagstatinclude",
            description: "Include only matching tags in `Statistics by Tag` in log and report",
            args: {
                name: "tag"
            }
        },
        {
            name: "--tagstatexclude",
            description: "Exclude matching tags from `Statistics by Tag`",
            args: {
                name: "tag"
            }
        },
        {
            name: "--tagstatcombine",
            description: "Create combined statistics based on tags. These statistics are added into `Statistics by Tag`",
            args: {
                name: "tags:name"
            }
        },
        {
            name: "--tagdoc",
            description: "Add documentation to tags matching the given pattern",
            args: {
                name: "pattern:doc"
            }
        },
        {
            name: "--tagstatlink",
            description: "Add external links into `Statistics by Tag`. Pattern can use `*`, `?` and `[]` as wildcards",
            args: {
                name: "pattern:link:title"
            }
        },
        {
            name: "--expandkeywords",
            description: "Matching keywords will be automatically expanded in the log file",
            args: {
                name: "pattern"
            }
        },
        {
            name: "--removekeywords",
            description: "Remove keyword data from the generated log file",
            args: {
                name: "pattern"
            }
        },
        {
            name: "--flattenkeywords",
            description: "Flattens matching keywords in the generated log file",
            args: {
                name: "pattern"
            }
        },
        {
            name: "--listener",
            description: "A class for monitoring test execution. Gets notifications e.g. when tests start and end",
            args: {
                name: "class"
            }
        },
        {
            name: "--nostatusrc",
            description: "Sets the return code to zero regardless of failures in test cases. Error codes are returned normally"
        },
        {
            name: "--dryrun",
            description: "Sets the return code to zero regardless of failures in test cases. Error codes are returned normally"
        },
        {
            name: ["-X", "--exitonfailure"],
            description: "Stops test execution if any test fails"
        },
        {
            name: "--exitonerror",
            description: "Stops test execution if any error occurs when parsing test data, importing libraries, and so on"
        },
        {
            name: "--skipteardownonexit",
            description: "Causes teardowns to be skipped if test execution is stopped prematurely"
        },
        {
            name: "--randomize",
            description: "Randomizes the test execution order",
            args: {
                name: "type"
            }
        },
        {
            name: "--prerunmodifier",
            description: "Class to programmatically modify the suite structure before execution",
            args: {
                name: "class"
            }
        },
        {
            name: "--prerebotmodifier",
            description: "Class to programmatically modify the result model before creating reports and logs",
            args: {
                name: "class"
            }
        },
        {
            name: "--console",
            description: "How to report execution on the console",
            args: {
                name: "type"
            }
        },
        {
            name: ["-.", "--dotted"],
            description: "Shortcut for `--console dotted`"
        },
        {
            name: "--quiet",
            description: "Shortcut for `--console quiet`"
        },
        {
            name: ["-W", "--consolewidth"],
            description: "Width of the console output. Default is 78",
            args: {
                name: "chars"
            }
        },
        {
            name: ["-C", "--consolecolors"],
            description: "Use colors on console output or not",
            args: {
                name: "option"
            }
        },
        {
            name: ["-K", "--consolemarkers"],
            description: "Show markers on the console when top level keywords in a test case end",
            args: {
                name: "option"
            }
        },
        {
            name: ["-P", "--pythonpath"],
            description: "Additional locations (directories, ZIPs) where to search libraries and other extensions when they are imported",
            args: {
                name: "path"
            }
        },
        {
            name: ["-A", "--argumentfile"],
            description: "Text file to read more arguments from. Use special path `STDIN` to read contents from the standard input stream",
            args: {
                name: "path"
            }
        },
        {
            name: "--version",
            description: "Print version information"
        }
    ]
};
export default completionSpec;
