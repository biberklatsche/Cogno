import { CommandSpec } from "../../spec.types";

export const KUBESCAPE_FIG_SPEC: CommandSpec = {
    name: "kubescape",
    source: "fig",
    subcommands: ["scan", "submit", "operator", "version", "help", "saa", "completion"],
    subcommandOptions: {
        scan: ["framework", "control", "image", "--format", "--verbose", "--exclude-namespaces", "--include-namespaces"],
        submit: ["--account", "--token", "--enable-host-sensor"],
        operator: ["install", "uninstall", "status"],
    },
};
