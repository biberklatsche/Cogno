import { CommandSpec } from "../../spec.types";

export const SQLITE3_FIG_SPEC: CommandSpec = {
    name: "sqlite3",
    source: "fig",
    subcommands: [".open", ".tables", ".schema", ".mode", ".headers", ".import", ".dump", ".quit"],
};

