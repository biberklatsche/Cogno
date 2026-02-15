import { CommandSpec } from "../../spec.types";

export const PSQL_FIG_SPEC: CommandSpec = {
    name: "psql",
    source: "fig",
    subcommands: ["-h", "-p", "-U", "-d", "-f", "-c", "-l", "--set", "--single-transaction"],
};

