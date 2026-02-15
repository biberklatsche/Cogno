import { CommandSpec } from "../../spec.types";

export const HELMWAVE_FIG_SPEC: CommandSpec = {
    name: "helmwave",
    source: "fig",
    subcommands: ["build", "up", "down", "diff", "apply", "destroy", "status", "graph", "template"],
};
