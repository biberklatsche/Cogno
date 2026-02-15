import { CommandSpec } from "../../spec.types";

export const CP_FIG_SPEC: CommandSpec = {
    name: "cp",
    source: "fig",
    subcommands: ["-r", "-a", "-v", "-f", "-i", "-n", "-u", "-p"],
};
