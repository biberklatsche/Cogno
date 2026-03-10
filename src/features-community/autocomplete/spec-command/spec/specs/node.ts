import { filepaths } from "@fig/autocomplete-generators";
import type { SubcommandSpec } from "../spec.types";
const completionSpec: SubcommandSpec = {
    name: "node",
    description: "Run the node interpreter",
    args: {
        name: "node script"
    },
    options: [
        {
            name: ["-e", "--eval=..."],
            description: "Evaluate script"
        },
        {
            name: "--watch",
            description: "Watch input files"
        },
        {
            name: "--watch-path",
            description: "Specify a watch directory or file",
            args: {
                name: "path"
            },
            isRepeatable: true
        },
        {
            name: "--watch-preserve-output",
            description: "Disable the clearing of the console when watch mode restarts the process"
        },
        {
            name: "--env-file",
            description: "Specify a file containing environment variables",
            args: {
                name: "path"
            },
            isRepeatable: true
        },
        {
            name: ["-p", "--print"],
            description: "Evaluate script and print result"
        },
        {
            name: ["-c", "--check"],
            description: "Syntax check script without executing"
        },
        {
            name: ["-v", "--version"],
            description: "Print Node.js version"
        },
        {
            name: ["-i", "--interactive"],
            description: "Always enter the REPL even if stdin does not appear to be a terminal"
        },
        {
            name: ["-h", "--help"],
            description: "Print node command line options (currently set)"
        },
        {
            name: "--inspect",
            args: {
                name: "[host:]port"
            },
            description: "Activate inspector on host:port (default: 127.0.0.1:9229)"
        },
        {
            name: "--preserve-symlinks",
            description: "Follows symlinks to directories when examining source code and templates for translation strings"
        }
    ]
};
export default completionSpec;
