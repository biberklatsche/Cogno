import { CommandSpec } from "../../spec.types";

export const PRE_COMMIT_FIG_SPEC: CommandSpec = {
    name: "pre-commit",
    source: "fig",
    subcommands: ["install", "run", "autoupdate", "clean", "gc", "sample-config", "try-repo", "validate-config"],
};
