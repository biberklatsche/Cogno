import { CommandSpec } from "../../spec.types";

export const EZA_FIG_SPEC: CommandSpec = {
    name: "eza",
    source: "fig",
    subcommands: ["-l", "-a", "-h", "-T", "-L", "--git", "--icons", "--group-directories-first"],
};
