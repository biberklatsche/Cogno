import { CommandSpec } from "../../spec.types";

export const AWK_FIG_SPEC: CommandSpec = {
    name: "awk",
    source: "fig",
    subcommands: ["-F", "-f", "-v", "-W", "-V"],
};
