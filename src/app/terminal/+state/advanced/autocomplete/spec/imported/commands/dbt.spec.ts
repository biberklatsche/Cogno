import { CommandSpec } from "../../spec.types";

export const DBT_FIG_SPEC: CommandSpec = {
    name: "dbt",
    source: "fig",
    subcommands: ["run", "test", "build", "seed", "snapshot", "compile", "debug", "deps", "docs", "source freshness"],
};

