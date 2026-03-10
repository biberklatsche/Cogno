import { dependenciesGenerator } from "./npm";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "nrm",
    description: "Use the right package manage - remove",
    options: [
        {
            name: "-g",
            description: "Operates in 'global' mode, so that packages are removed from the prefix folder instead of the current working directory"
        },
        {
            name: "-D",
            description: "Package will be removed from your `devDependencies`"
        },
        {
            name: "-P",
            description: "Remove package from your `peerDependencies`"
        },
        {
            name: "-O",
            description: "Remove package from your `optionalDependencies`"
        },
        {
            name: "--frozen",
            description: "Don't generate a lockfile and fail if an update is needed"
        },
        {
            name: ["-h", "--help"],
            description: "Output usage information"
        }
    ]
};
export default completionSpec;
