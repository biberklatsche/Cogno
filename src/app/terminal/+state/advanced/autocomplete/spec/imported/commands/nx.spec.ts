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
    subcommandOptions: {
        run: ["--configuration", "--skip-nx-cache", "--parallel"],
        affected: ["--target", "--base", "--head", "--parallel", "--configuration", "--projects"],
        generate: ["--project", "--dry-run", "--interactive"],
    },
};
