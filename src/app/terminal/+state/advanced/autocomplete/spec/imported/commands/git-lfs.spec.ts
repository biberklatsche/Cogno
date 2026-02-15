import { CommandSpec } from "../../spec.types";

export const GIT_LFS_FIG_SPEC: CommandSpec = {
    name: "git-lfs",
    source: "fig",
    subcommands: ["install", "track", "untrack", "ls-files", "fetch", "pull", "push", "prune", "locks"],
};
