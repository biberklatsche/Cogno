import { CommandSpec } from "../../spec.types";

export const LSOF_FIG_SPEC: CommandSpec = {
    name: "lsof",
    source: "fig",
    subcommands: ["-i", "-p", "-u", "-c", "-n", "-P", "+D", "+d"],
};
