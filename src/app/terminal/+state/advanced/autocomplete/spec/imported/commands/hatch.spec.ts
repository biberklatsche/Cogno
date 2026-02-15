import { CommandSpec } from "../../spec.types";

export const HATCH_FIG_SPEC: CommandSpec = {
    name: "hatch",
    source: "fig",
    subcommands: ["new", "run", "env", "python", "build", "publish", "version", "shell", "status"],
};
