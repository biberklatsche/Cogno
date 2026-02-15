import { CommandSpec } from "../../spec.types";

export const MINIKUBE_FIG_SPEC: CommandSpec = {
    name: "minikube",
    source: "fig",
    subcommands: [
        "start",
        "stop",
        "delete",
        "status",
        "dashboard",
        "addons",
        "kubectl",
        "image",
        "service",
        "ssh",
    ],
};

