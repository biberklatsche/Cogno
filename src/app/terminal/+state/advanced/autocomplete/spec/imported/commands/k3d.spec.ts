import { CommandSpec } from "../../spec.types";

export const K3D_FIG_SPEC: CommandSpec = {
    name: "k3d",
    source: "fig",
    subcommands: ["cluster", "node", "kubeconfig", "image", "registry", "completion", "version"],
};

