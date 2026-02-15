import { CommandSpec } from "../../spec.types";

export const CLICKHOUSE_CLIENT_FIG_SPEC: CommandSpec = {
    name: "clickhouse-client",
    source: "fig",
    subcommands: ["--host", "--port", "--user", "--password", "--query", "--database", "--multiquery"],
};
