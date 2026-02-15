import { CommandSpec } from "../../spec.types";

export const KPT_FIG_SPEC: CommandSpec = {
    name: "kpt",
    source: "fig",
    subcommands: ["pkg", "fn", "live", "alpha", "beta", "cfg", "version", "completion"],
};
