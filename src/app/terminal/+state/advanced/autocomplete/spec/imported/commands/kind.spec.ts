import { CommandSpec } from "../../spec.types";

export const KIND_FIG_SPEC: CommandSpec = {
    name: "kind",
    source: "fig",
    subcommands: [
        "create",
        "delete",
        "get",
        "load",
        "export",
        "build",
        "completion",
        "version",
    ],
};

