import { CommandSpec } from "../../spec.types";

export const PRE_COMMIT_FIG_SPEC: CommandSpec = {
    name: "pre-commit",
    source: "fig",
    subcommands: ["install", "run", "autoupdate", "clean", "gc", "sample-config", "try-repo", "validate-config"],
    subcommandOptions: {
        run: ["--all-files", "--files", "--hook-stage", "--from-ref", "--to-ref", "--show-diff-on-failure"],
        install: ["--install-hooks", "--overwrite", "--hook-type"],
        autoupdate: ["--repo", "--freeze", "--bleeding-edge"],
    },
};
