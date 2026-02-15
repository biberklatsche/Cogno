import { CommandSpec } from "../../spec.types";

export const CUT_FIG_SPEC: CommandSpec = {
    name: "cut",
    source: "fig",
    subcommands: ["-f", "-d", "-c", "-b", "--complement", "-s"],
};
