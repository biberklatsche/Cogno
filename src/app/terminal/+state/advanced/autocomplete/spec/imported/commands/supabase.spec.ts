import { CommandSpec } from "../../spec.types";

export const SUPABASE_FIG_SPEC: CommandSpec = {
    name: "supabase",
    source: "fig",
    subcommands: ["init", "start", "stop", "db", "migration", "gen", "functions", "secrets", "login", "status"],
    subcommandOptions: {
        db: ["start", "stop", "reset", "dump", "push", "pull", "diff", "lint"],
        migration: ["new", "up", "down", "repair", "fetch", "list"],
        functions: ["new", "serve", "deploy", "list", "delete"],
        secrets: ["set", "list", "unset"],
    },
};
