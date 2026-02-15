import { CommandSpec } from "../../spec.types";

export const SORT_FIG_SPEC: CommandSpec = {
    name: "sort",
    source: "fig",
    subcommands: ["-r", "-n", "-u", "-k", "-t", "-h", "-V"],
};
