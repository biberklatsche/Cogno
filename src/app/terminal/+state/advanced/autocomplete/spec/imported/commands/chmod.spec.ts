import { CommandSpec } from "../../spec.types";

export const CHMOD_FIG_SPEC: CommandSpec = {
    name: "chmod",
    source: "fig",
    subcommands: ["-R", "-v", "-c", "--reference"],
};
