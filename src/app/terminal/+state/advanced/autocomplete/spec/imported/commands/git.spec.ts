import { CommandSpec } from "../../spec.types";

export const GIT_FIG_SPEC: CommandSpec = {
    name: "git",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/git.ts",
    subcommands: [
        "status",
        "add",
        "commit",
        "push",
        "pull",
        "checkout",
        "switch",
        "branch",
        "merge",
        "rebase",
        "stash",
        "fetch",
        "clone",
        "reset",
        "log",
    ],
};

