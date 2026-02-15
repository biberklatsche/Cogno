import { CommandSpec } from "../../spec.types";

export const RMDIR_FIG_SPEC: CommandSpec = {
    name: "rmdir",
    source: "fig",
    subcommands: ["-p", "-v", "--ignore-fail-on-non-empty"],
};
