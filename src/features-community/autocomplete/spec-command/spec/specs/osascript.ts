import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "osascript",
    description: "Execute OSA scripts (AppleScript, JavaScript, etc.)",
    options: [
        {
            name: "-e",
            description: "Enter one line of a script",
            args: {
                name: "statement"
            }
        },
        {
            name: "-i",
            description: "Interactive mode"
        },
        {
            name: "-l",
            description: "Override the language for any plain text files",
            args: {
                name: "language"
            }
        },
        {
            name: "-s",
            description: "Modify the output style",
            args: {
                name: "flags"
            }
        }
    ]
};
export default completionSpec;
