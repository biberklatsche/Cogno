import { CommandSpec } from "../../spec.types";

export const GH_FIG_SPEC: CommandSpec = {
    name: "gh",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/gh.ts",
    subcommands: ["auth", "repo", "pr", "issue", "gist", "release", "workflow", "run", "api"],
};

