import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "create-remix",
    options: [
        {
            name: ["-h", "--help"],
            description: "Display help for command"
        },
        {
            name: ["-v", "--version"],
            description: "Display version for command"
        }
    ]
};
export default completionSpec;
