import { CommandSpec } from "../../spec.types";

export const ORAS_FIG_SPEC: CommandSpec = {
    name: "oras",
    source: "fig",
    subcommands: ["push", "pull", "attach", "discover", "manifest", "repo", "login", "logout", "cp"],
};
