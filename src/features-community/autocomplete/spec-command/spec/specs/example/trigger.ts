// To Test:
// Drag this file out of dev/example/ into dev/ and then type "trigger" in the command line
// Known bugs: If you backspace after inserting _prefix_string_for_file_and_folder_suggestions it won't render suggestions
// NOTE: replace _prefix_string_for_file_and_folder_suggestions with whatever prefix you'd like e.g. "s3://"
import type { ArgSpec, CommandSpec } from "../../spec.types";
const _prefix_string_for_file_and_folder_suggestions = "file://";
var customArgument: ArgSpec = {
    name: "FILE/FOLDER",
    description: "must start with " + _prefix_string_for_file_and_folder_suggestions
};
const completionSpec: CommandSpec = {
    name: "trigger_example",
    description: "",
    subcommands: [
        {
            name: "test",
            args: customArgument
        }
    ]
};
export default completionSpec;
