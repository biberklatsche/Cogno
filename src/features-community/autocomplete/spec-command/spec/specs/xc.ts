import type { CommandSpec, OptionSpec, SubcommandSpec } from "../spec.types";
/**
 * https://github.com/joerdav/xc
 * xc - Simple, Convenient, Markdown-based task runner.
 * v0.2.0
 */
const completionSpec: CommandSpec = {
    name: "xc",
    description: "List tasks from an xc-compatible markdown file",
    options: [
        {
            name: ["-s", "-short"],
            description: "List task names in a short format"
        },
        {
            name: ["-h", "-help"],
            description: "Print this help text"
        },
        {
            name: ["-f", "-file"],
            args: {
                name: "path"
            },
            description: 'Specify a markdown file that contains tasks (default: "README.md")'
        },
        {
            name: ["-H", "-heading"],
            args: {
                name: "heading"
            },
            description: 'Specify the heading for xc tasks (default: "Tasks")'
        },
        {
            name: ["-V", "-version"],
            description: "Show xc version"
        },
        {
            name: "-complete",
            description: "Install shell completion for xc"
        },
        {
            name: "-uncomplete",
            description: "Uninstall shell completion for xc"
        }
    ]
};
export default completionSpec;
