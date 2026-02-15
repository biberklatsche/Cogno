import { CommandSpec } from "../../spec.types";

export const PG_RESTORE_FIG_SPEC: CommandSpec = {
    name: "pg_restore",
    source: "fig",
    subcommands: ["-h", "-p", "-U", "-d", "-j", "-c", "-C", "-n", "-t", "-v"],
};
