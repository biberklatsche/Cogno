import { CommandSpec } from "../../spec.types";

export const TAIL_FIG_SPEC: CommandSpec = {
    name: "tail",
    source: "fig",
    subcommands: ["-n", "-f", "-F", "-c", "--pid", "-q", "-v"],
};
