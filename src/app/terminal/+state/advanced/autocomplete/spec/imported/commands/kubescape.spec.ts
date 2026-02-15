import { CommandSpec } from "../../spec.types";

export const KUBESCAPE_FIG_SPEC: CommandSpec = {
    name: "kubescape",
    source: "fig",
    subcommands: ["scan", "submit", "operator", "version", "help", "saa", "completion"],
};
