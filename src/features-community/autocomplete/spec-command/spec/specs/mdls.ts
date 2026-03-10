import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "mdls",
    description: "Lists the metadata attributes for the specified file",
    options: [
        {
            name: ["--name", "-name"],
            description: "Print only the matching metadata attribute value.  Can be used multiple times",
            isRepeatable: true,
            args: {
                name: "attributeName",
                description: "Metadata attribute name"
            }
        },
        {
            name: ["--raw", "-raw"],
            description: "Print raw attribute data in the order that was requested. Fields will be separated with a ASCII NUL character, suitable for piping to xargs(1) -0"
        },
        {
            name: ["--nullMarker", "-nullMarker"],
            description: "Sets a marker string to be used when a requested attribute is null. Only used in -raw mode.  Default is '(null)'"
        },
        // TODO(platform): macos only option
        {
            name: ["--plist", "-plist"],
            description: "Output attributes in XML format to file. Use - to write to stdout option. Incompatible with options -raw, -nullMarker, and -name",
            args: [
                {
                    name: "stdout or file",
                    description: "XML output location"
                },
                {
                    name: "file",
                    description: "File to read from"
                }
            ]
        }
    ]
};
export default completionSpec;
