import { CommandSpec } from "../../spec.types";

export const FLUX_FIG_SPEC: CommandSpec = {
    name: "flux",
    source: "fig",
    subcommands: [
        "bootstrap",
        "create",
        "get",
        "reconcile",
        "suspend",
        "resume",
        "delete",
        "logs",
        "tree",
        "version",
    ],
};

