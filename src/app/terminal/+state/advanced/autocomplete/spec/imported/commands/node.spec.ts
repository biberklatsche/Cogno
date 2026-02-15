import { CommandSpec } from "../../spec.types";

export const NODE_FIG_SPEC: CommandSpec = {
    name: "node",
    source: "fig",
    subcommands: ["--version", "--eval", "--print", "--watch", "--inspect", "--test", "--run"],
};

