import { CommandSpec } from "../../spec.types";

export const PGCLI_FIG_SPEC: CommandSpec = {
    name: "pgcli",
    source: "fig",
    subcommands: ["-h", "-p", "-U", "-d", "-W", "--single-connection", "--ssh-tunnel", "--version"],
};
