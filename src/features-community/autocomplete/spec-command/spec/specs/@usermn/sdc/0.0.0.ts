import type { SubcommandSpec, VersionDiffMap } from "../../../spec.types";
const completion: SubcommandSpec = {
    name: "sdc",
    description: '"setup dominic\'s computer" cli tool',
    subcommands: [
        {
            name: "help",
            description: "Display help for command",
            args: {
                name: "command"
            }
        }
    ],
    options: [
        {
            name: ["-V", "--version"],
            description: "Output the version number"
        },
        {
            name: ["-f", "--force"],
            description: "Bypass checks"
        },
        {
            name: "--no-end-clear",
            description: "Skip clearing the console at the end so that output can be viewed"
        },
        {
            name: ["-h", "--help"],
            description: "Display help for command"
        }
    ]
};
const versions: VersionDiffMap = {};
versions["0.0.4"] = {};
versions["0.0.7"] = {
    options: [
        {
            name: "--debug-options",
            description: "Print options to console for debugging",
        },
        {
            name: ["-c", "--confirm-commands"],
            description: "Confirm commands before running them",
        }
    ],
};
export { versions };
export default completion;
