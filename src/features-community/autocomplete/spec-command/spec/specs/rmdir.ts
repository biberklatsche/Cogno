import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "rmdir",
    description: "Remove directories",
    options: [
        {
            name: "-p",
            description: "Remove each directory of path"
        }
    ]
};
export default completionSpec;
