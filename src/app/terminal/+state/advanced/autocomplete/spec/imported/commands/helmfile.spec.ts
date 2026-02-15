import { CommandSpec } from "../../spec.types";

export const HELMFILE_FIG_SPEC: CommandSpec = {
    name: "helmfile",
    source: "fig",
    subcommands: ["apply", "sync", "diff", "template", "lint", "destroy", "deps", "list", "repos"],
};
