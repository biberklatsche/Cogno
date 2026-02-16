import { CommandSpec } from "../../spec.types";

export const GH_FIG_SPEC: CommandSpec = {
    name: "gh",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/gh.ts",
    subcommands: ["auth", "repo", "pr", "issue", "gist", "release", "workflow", "run", "api"],
    subcommandOptions: {
        pr: ["create", "list", "view", "checkout", "merge", "--repo", "--web"],
        issue: ["create", "list", "view", "close", "reopen", "--repo", "--web"],
        repo: ["clone", "create", "view", "fork", "--public", "--private", "--source"],
        workflow: ["list", "view", "run", "--repo", "--ref"],
    },
};
