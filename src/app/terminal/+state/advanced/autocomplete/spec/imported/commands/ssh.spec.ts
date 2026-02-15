import { CommandSpec } from "../../spec.types";

export const SSH_FIG_SPEC: CommandSpec = {
    name: "ssh",
    source: "fig",
    subcommands: ["-i", "-p", "-L", "-R", "-D", "-J", "-A", "-T", "-v", "-o"],
};

