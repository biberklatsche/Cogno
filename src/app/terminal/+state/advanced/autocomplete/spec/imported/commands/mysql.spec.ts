import { CommandSpec } from "../../spec.types";

export const MYSQL_FIG_SPEC: CommandSpec = {
    name: "mysql",
    source: "fig",
    subcommands: ["-h", "-P", "-u", "-p", "-D", "-e", "--ssl-mode", "--default-character-set"],
};

