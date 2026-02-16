import { CommandSpec } from "../../spec.types";

export const HELM_FIG_SPEC: CommandSpec = {
    name: "helm",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/helm.ts",
    subcommands: [
        "install",
        "upgrade",
        "uninstall",
        "list",
        "repo",
        "search",
        "template",
        "lint",
        "status",
        "history",
        "rollback",
        "dependency",
    ],
    subcommandOptions: {
        install: ["--namespace", "--create-namespace", "--set", "--set-string", "--values", "--version", "--wait"],
        upgrade: ["--install", "--namespace", "--set", "--set-string", "--values", "--reuse-values", "--wait"],
        uninstall: ["--namespace", "--keep-history", "--wait"],
        template: ["--namespace", "--set", "--set-string", "--values", "--include-crds"],
    },
};
