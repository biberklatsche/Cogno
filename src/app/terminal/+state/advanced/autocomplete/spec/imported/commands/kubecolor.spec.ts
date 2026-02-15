import { CommandSpec } from "../../spec.types";

export const KUBECOLOR_FIG_SPEC: CommandSpec = {
    name: "kubecolor",
    source: "fig",
    subcommands: ["get", "describe", "apply", "delete", "logs", "exec", "-n", "-A", "--context"],
};
