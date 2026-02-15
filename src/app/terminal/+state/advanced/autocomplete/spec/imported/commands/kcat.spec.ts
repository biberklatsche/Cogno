import { CommandSpec } from "../../spec.types";

export const KCAT_FIG_SPEC: CommandSpec = {
    name: "kcat",
    source: "fig",
    subcommands: ["-b", "-t", "-C", "-P", "-L", "-G", "-f", "-o", "-e", "-X"],
};
