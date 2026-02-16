import { CommandSpec } from "../../spec.types";

export const OC_FIG_SPEC: CommandSpec = {
    name: "oc",
    source: "fig",
    subcommands: ["get", "describe", "apply", "delete", "logs", "exec", "project", "new-project", "whoami", "login"],
    subcommandOptions: {
        get: ["-n", "-A", "-o", "--selector", "--watch"],
        apply: ["-f", "-k", "--dry-run", "--server-side"],
        delete: ["-f", "-k", "-n", "--grace-period", "--force"],
        logs: ["-f", "-n", "--tail", "--since", "-c", "--timestamps"],
        exec: ["-it", "-n", "-c", "--"],
    },
};
