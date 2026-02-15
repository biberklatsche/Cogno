import { CommandSpec } from "../../spec.types";

export const PG_DUMP_FIG_SPEC: CommandSpec = {
    name: "pg_dump",
    source: "fig",
    subcommands: ["-h", "-p", "-U", "-d", "-f", "-F", "-j", "-s", "-a"],
};
