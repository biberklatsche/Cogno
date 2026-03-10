import { filepaths } from "@fig/autocomplete-generators";
import type { ArgSpec, CommandSpec } from "../spec.types";
const scriptPathArgs: ArgSpec = {
    name: "script path"
};
const completionSpec: CommandSpec = {
    name: "tsx",
    description: "Run TypeScript file using tsx",
    subcommands: [
        {
            name: "watch",
            description: "Run the script and watch for changes",
            args: scriptPathArgs
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for tsx"
        },
        {
            name: "--no-cache",
            description: "Disable caching"
        },
        {
            name: "--clear-screen",
            description: "Disable clearing the screen on rerun",
            args: scriptPathArgs
        },
        {
            name: ["-v", "--version"],
            description: "Show version"
        },
        {
            name: "--tsconfig",
            description: "Custom tsconfig.json path",
            args: {
                name: "tsconfig.json path"
            }
        }
    ]
};
export default completionSpec;
