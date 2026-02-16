import { CommandSpec } from "../../spec.types";

export const HELMFILE_FIG_SPEC: CommandSpec = {
    name: "helmfile",
    source: "fig",
    subcommands: ["apply", "sync", "diff", "template", "lint", "destroy", "deps", "list", "repos"],
    subcommandOptions: {
        apply: ["-f", "-e", "-l", "--interactive", "--skip-deps", "--suppress-diff"],
        sync: ["-f", "-e", "-l", "--skip-deps", "--concurrency"],
        diff: ["-f", "-e", "-l", "--context", "--detailed-exitcode"],
        template: ["-f", "-e", "-l", "--output-dir", "--skip-deps"],
    },
};
