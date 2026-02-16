import { CommandSpec } from "../../spec.types";

export const KCAT_FIG_SPEC: CommandSpec = {
    name: "kcat",
    source: "fig",
    subcommands: ["-b", "-t", "-C", "-P", "-L", "-G", "-f", "-o", "-e", "-X"],
    subcommandOptions: {
        "-C": ["-b", "-t", "-o", "-e", "-q", "-u", "-X"],
        "-P": ["-b", "-t", "-K", "-Z", "-q", "-X"],
        "-L": ["-b", "-t", "-J", "-X"],
        "-G": ["-b", "-t", "-e", "-o", "-X"],
    },
};
