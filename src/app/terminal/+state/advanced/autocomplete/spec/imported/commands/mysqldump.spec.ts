import { CommandSpec } from "../../spec.types";

export const MYSQLDUMP_FIG_SPEC: CommandSpec = {
    name: "mysqldump",
    source: "fig",
    subcommands: ["-h", "-P", "-u", "-p", "--databases", "--tables", "--single-transaction"],
};
