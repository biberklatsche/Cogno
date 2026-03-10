import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "mknod",
    description: "Create device special file",
    subcommands: [
        {
            name: "c",
            description: "Create (c)haracter device"
        },
        {
            name: "b",
            description: "Create (b)lock device"
        }
    ],
    options: [
        {
            name: "-F",
            description: "Format",
            args: {
                name: "FORMAT"
            }
        }
    ]
};
export default completionSpec;
