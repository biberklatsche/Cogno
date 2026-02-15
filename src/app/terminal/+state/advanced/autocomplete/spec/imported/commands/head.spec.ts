import { CommandSpec } from "../../spec.types";

export const HEAD_FIG_SPEC: CommandSpec = {
    name: "head",
    source: "fig",
    subcommands: ["-n", "-c", "-q", "-v"],
};
