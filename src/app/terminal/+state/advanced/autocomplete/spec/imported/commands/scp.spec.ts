import { CommandSpec } from "../../spec.types";

export const SCP_FIG_SPEC: CommandSpec = {
    name: "scp",
    source: "fig",
    subcommands: ["-r", "-P", "-i", "-J", "-C", "-p", "-q", "-o"],
};

