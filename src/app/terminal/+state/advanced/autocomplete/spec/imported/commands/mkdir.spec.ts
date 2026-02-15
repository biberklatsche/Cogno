import { CommandSpec } from "../../spec.types";

export const MKDIR_FIG_SPEC: CommandSpec = {
    name: "mkdir",
    source: "fig",
    subcommands: ["-p", "-m", "-v", "-Z", "--parents"],
};
