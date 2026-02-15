import { CommandSpec } from "../../spec.types";

export const K3S_FIG_SPEC: CommandSpec = {
    name: "k3s",
    source: "fig",
    subcommands: ["server", "agent", "kubectl", "crictl", "ctr", "check-config", "etcd-snapshot", "uninstall"],
};

