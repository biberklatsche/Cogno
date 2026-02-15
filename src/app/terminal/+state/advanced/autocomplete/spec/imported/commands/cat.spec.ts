import { CommandSpec } from "../../spec.types";

export const CAT_FIG_SPEC: CommandSpec = {
    name: "cat",
    source: "fig",
    subcommands: ["-n", "-b", "-s", "-A", "-T", "-E"],
};
