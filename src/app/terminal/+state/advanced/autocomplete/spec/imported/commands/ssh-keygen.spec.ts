import { CommandSpec } from "../../spec.types";

export const SSH_KEYGEN_FIG_SPEC: CommandSpec = {
    name: "ssh-keygen",
    source: "fig",
    subcommands: ["-t", "-f", "-C", "-N", "-b", "-q", "-A", "-p", "-y", "-l"],
};

