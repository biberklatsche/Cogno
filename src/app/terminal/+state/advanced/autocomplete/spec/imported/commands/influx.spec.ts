import { CommandSpec } from "../../spec.types";

export const INFLUX_FIG_SPEC: CommandSpec = {
    name: "influx",
    source: "fig",
    subcommands: ["auth", "bucket", "config", "delete", "org", "query", "task", "user", "write", "version"],
};
