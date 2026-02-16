import { CommandSpec } from "../../spec.types";

export const KAFKACAT_FIG_SPEC: CommandSpec = {
    name: "kafkacat",
    source: "fig",
    subcommands: ["-b", "-t", "-C", "-P", "-L", "-G", "-f", "-o", "-e", "-X"],
    subcommandOptions: {
        "-C": ["-b", "-t", "-o", "-e", "-q", "-u", "-X"],
        "-P": ["-b", "-t", "-K", "-Z", "-q", "-X"],
        "-L": ["-b", "-t", "-J", "-X"],
        "-G": ["-b", "-t", "-e", "-o", "-X"],
    },
};
