import { CommandSpec } from "../../spec.types";

export const CILIUM_FIG_SPEC: CommandSpec = {
    name: "cilium",
    source: "fig",
    subcommands: ["install", "upgrade", "status", "connectivity", "hubble", "config", "uninstall", "version"],
    subcommandOptions: {
        install: ["--version", "--set", "--namespace", "--wait"],
        status: ["--wait", "--verbose", "--interactive"],
        connectivity: ["test", "--single-node", "--flow-validation", "--test", "--single-stack"],
    },
};
