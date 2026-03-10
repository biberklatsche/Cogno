import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "fold",
    description: "Fold long lines for finite width output device",
    options: [
        {
            name: "-b",
            description: `Count width in bytes rather than column positions`
        },
        {
            name: "-s",
            description: `Fold line after the last blank character within the first width
column positions (or bytes)`
        },
        {
            name: "-w",
            description: `Specify a line width to use instead of the default 80 columns.
The width value should be a multiple of 8 if tabs are present,
or the tabs should be expanded using expand(1) before using
fold`,
            args: {
                name: "width"
            }
        }
    ]
};
export default completionSpec;
