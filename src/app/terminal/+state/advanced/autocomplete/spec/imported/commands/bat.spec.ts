import { CommandSpec } from "../../spec.types";

export const BAT_FIG_SPEC: CommandSpec = {
    name: "bat",
    source: "fig",
    subcommands: ["--style", "--theme", "--language", "--paging", "--plain", "--line-range", "--diff"],
};

