import { CommandSpec } from "../../spec.types";

export const CILIUM_FIG_SPEC: CommandSpec = {
    name: "cilium",
    source: "fig",
    subcommands: ["install", "upgrade", "status", "connectivity", "hubble", "config", "uninstall", "version"],
};
