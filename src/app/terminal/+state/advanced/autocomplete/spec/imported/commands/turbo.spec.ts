import { CommandSpec } from "../../spec.types";

export const TURBO_FIG_SPEC: CommandSpec = {
    name: "turbo",
    source: "fig",
    subcommands: ["run", "build", "test", "lint", "dev", "prune", "query", "link", "unlink", "daemon"],
    subcommandOptions: {
        run: ["--filter", "--parallel", "--concurrency", "--summarize", "--dry-run"],
        prune: ["--scope", "--docker", "--out-dir"],
        query: ["--graph", "--scope"],
    },
};
