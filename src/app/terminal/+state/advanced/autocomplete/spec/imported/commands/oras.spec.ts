import { CommandSpec } from "../../spec.types";

export const ORAS_FIG_SPEC: CommandSpec = {
    name: "oras",
    source: "fig",
    subcommands: ["push", "pull", "attach", "discover", "manifest", "repo", "login", "logout", "cp"],
    subcommandOptions: {
        push: ["--artifact-type", "--annotation", "--config", "--concurrency", "--plain-http"],
        pull: ["--output", "--include-subject", "--concurrency", "--plain-http"],
        discover: ["--artifact-type", "--distribution-spec", "--plain-http"],
    },
};
