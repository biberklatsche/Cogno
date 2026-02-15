import { CommandSpec } from "../../spec.types";

export const MC_FIG_SPEC: CommandSpec = {
    name: "mc",
    source: "fig",
    subcommands: ["alias", "admin", "cp", "mv", "ls", "mb", "rm", "mirror", "stat", "version"],
};
