import { CommandSpec } from "../../spec.types";

export const SED_FIG_SPEC: CommandSpec = {
    name: "sed",
    source: "fig",
    subcommands: ["-n", "-E", "-e", "-f", "-i", "-l"],
};
