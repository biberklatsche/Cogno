import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "tail",
    description: "Display the last part of a file",
    options: [
        {
            name: "-f",
            description: "Wait for additional data to be appended"
        },
        {
            name: "-r",
            description: "Display in reverse order"
        }
    ]
};
export default completionSpec;
