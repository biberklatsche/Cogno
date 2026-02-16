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
    subcommandOptions: {
        get: ["-n", "-A", "-o", "--watch", "--selector"],
        describe: ["-n", "-A"],
        apply: ["-f", "-k", "--dry-run", "--server-side", "--prune", "--validate"],
        delete: ["-f", "-k", "-n", "--grace-period", "--force"],
        logs: ["-f", "-n", "--tail", "--since", "-c", "--previous", "--timestamps"],
        exec: ["-it", "-n", "-c", "--"],
        "port-forward": ["-n", "--address", "--pod-running-timeout"],
    },
};
