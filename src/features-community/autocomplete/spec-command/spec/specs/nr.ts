import { npmScriptsGenerator } from "./npm";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "nr",
    description: "Use the right package manager - run",
    options: [
        {
            name: ["-h", "--help"],
            description: "Output usage information"
        }
    ]
};
export default completionSpec;
