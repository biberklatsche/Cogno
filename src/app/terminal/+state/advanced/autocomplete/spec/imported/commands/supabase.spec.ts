import { CommandSpec } from "../../spec.types";

export const SUPABASE_FIG_SPEC: CommandSpec = {
    name: "supabase",
    source: "fig",
    subcommands: ["init", "start", "stop", "db", "migration", "gen", "functions", "secrets", "login", "status"],
};
