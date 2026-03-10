import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "w",
    description: "Display who is logged in and what they are doing",
    options: [
        {
            name: "-h",
            description: "Suppress the heading"
        },
        {
            name: "-i",
            description: "Output is sorted by idle time"
        }
    ]
};
export default completionSpec;
