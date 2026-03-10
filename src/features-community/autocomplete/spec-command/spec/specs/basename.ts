import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "basename",
    description: "Return filename portion of pathname",
    options: [
        {
            name: "-a",
            description: "Treat every argument as a string"
        },
        {
            name: "-s",
            description: "Suffix to remove from string",
            args: {
                name: "suffix"
            }
        }
    ]
};
export default completionSpec;
