import { CommandSpec } from "../../spec.types";

export const TREE_FIG_SPEC: CommandSpec = {
    name: "tree",
    source: "fig",
    subcommands: ["-a", "-d", "-L", "-I", "--dirsfirst", "--gitignore", "-h", "-C"],
};
