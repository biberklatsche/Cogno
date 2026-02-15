import { CommandSpec } from "../../spec.types";

export const TURBO_FIG_SPEC: CommandSpec = {
    name: "turbo",
    source: "fig",
    subcommands: ["run", "build", "test", "lint", "dev", "prune", "query", "link", "unlink", "daemon"],
};

