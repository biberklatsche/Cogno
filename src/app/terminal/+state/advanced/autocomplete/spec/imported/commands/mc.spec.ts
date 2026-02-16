import { CommandSpec } from "../../spec.types";

export const MC_FIG_SPEC: CommandSpec = {
    name: "mc",
    source: "fig",
    subcommands: ["alias", "admin", "cp", "mv", "ls", "mb", "rm", "mirror", "stat", "version"],
    subcommandOptions: {
        alias: ["set", "ls", "rm", "import", "export"],
        admin: ["user", "policy", "group", "info", "heal", "trace"],
        cp: ["--recursive", "--attr", "--newer-than", "--older-than", "--storage-class"],
        mirror: ["--watch", "--overwrite", "--remove", "--md5", "--exclude"],
    },
};
