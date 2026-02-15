import { CommandSpec } from "../../spec.types";

export const SFTP_FIG_SPEC: CommandSpec = {
    name: "sftp",
    source: "fig",
    subcommands: ["-P", "-i", "-J", "-C", "-q", "-r", "-b", "-o"],
};

