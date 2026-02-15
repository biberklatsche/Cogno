import { CommandSpec } from "../../spec.types";

export const SAM_FIG_SPEC: CommandSpec = {
    name: "sam",
    source: "fig",
    subcommands: [
        "init",
        "build",
        "local",
        "deploy",
        "sync",
        "validate",
        "logs",
        "pipeline",
        "delete",
    ],
};

