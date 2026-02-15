import { CommandSpec } from "../../spec.types";

export const ISTIOCTL_FIG_SPEC: CommandSpec = {
    name: "istioctl",
    source: "fig",
    subcommands: ["install", "upgrade", "uninstall", "analyze", "proxy-status", "proxy-config", "dashboard", "x"],
};
