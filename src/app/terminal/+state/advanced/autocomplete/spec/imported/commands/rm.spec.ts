import { CommandSpec } from "../../spec.types";

export const RM_FIG_SPEC: CommandSpec = {
    name: "rm",
    source: "fig",
    subcommands: ["-r", "-f", "-i", "-I", "-v", "-d"],
};
