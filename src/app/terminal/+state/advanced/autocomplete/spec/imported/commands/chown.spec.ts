import { CommandSpec } from "../../spec.types";

export const CHOWN_FIG_SPEC: CommandSpec = {
    name: "chown",
    source: "fig",
    subcommands: ["-R", "-h", "-v", "-c", "--reference"],
};
