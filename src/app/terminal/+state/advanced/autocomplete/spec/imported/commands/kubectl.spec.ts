import { CommandSpec } from "../../spec.types";

export const KUBECTL_FIG_SPEC: CommandSpec = {
    name: "kubectl",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/kubectl.ts",
    subcommands: [
        "get",
        "describe",
        "apply",
        "delete",
        "logs",
        "exec",
        "port-forward",
        "config",
        "set",
        "create",
        "edit",
    ],
};

