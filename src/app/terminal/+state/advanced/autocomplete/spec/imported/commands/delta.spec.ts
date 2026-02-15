import { CommandSpec } from "../../spec.types";

export const DELTA_FIG_SPEC: CommandSpec = {
    name: "delta",
    source: "fig",
    subcommands: ["--side-by-side", "--line-numbers", "--navigate", "--syntax-theme", "--features", "--paging", "--raw"],
};
