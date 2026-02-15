import { CommandSpec } from "../../spec.types";

export const NX_FIG_SPEC: CommandSpec = {
    name: "nx",
    source: "fig",
    subcommands: [
        "serve",
        "build",
        "test",
        "lint",
        "e2e",
        "graph",
        "run",
        "run-many",
        "affected",
        "generate",
        "format",
    ],
};

