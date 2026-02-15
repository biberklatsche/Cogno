import { CommandSpec } from "../../spec.types";

export const MYSQLADMIN_FIG_SPEC: CommandSpec = {
    name: "mysqladmin",
    source: "fig",
    subcommands: ["create", "drop", "processlist", "status", "variables", "ping", "shutdown", "version"],
};
