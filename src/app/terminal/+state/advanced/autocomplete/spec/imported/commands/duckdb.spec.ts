import { CommandSpec } from "../../spec.types";

export const DUCKDB_FIG_SPEC: CommandSpec = {
    name: "duckdb",
    source: "fig",
    subcommands: ["-c", "-s", "-readonly", "-unsigned", "-version", "-help"],
};
