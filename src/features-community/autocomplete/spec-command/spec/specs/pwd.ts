import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "pwd",
    description: "Return working directory name",
    options: [
        {
            name: "-L",
            description: "Display the logical current working directory"
        },
        {
            name: "-P",
            description: "Display the physical current working directory"
        }
    ]
};
export default completionSpec;
