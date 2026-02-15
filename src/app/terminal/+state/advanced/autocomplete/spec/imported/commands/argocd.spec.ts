import { CommandSpec } from "../../spec.types";

export const ARGOCD_FIG_SPEC: CommandSpec = {
    name: "argocd",
    source: "fig",
    subcommands: [
        "login",
        "app",
        "proj",
        "cluster",
        "repo",
        "account",
        "context",
        "admin",
        "version",
    ],
};

