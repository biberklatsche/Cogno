import { CommandSpec } from "../../spec.types";

export const KAFKACAT_FIG_SPEC: CommandSpec = {
    name: "kafkacat",
    source: "fig",
    subcommands: ["-b", "-t", "-C", "-P", "-L", "-G", "-f", "-o", "-e", "-X"],
};
