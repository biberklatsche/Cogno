import { CommandSpec } from "../../spec.types";

export const OC_FIG_SPEC: CommandSpec = {
    name: "oc",
    source: "fig",
    subcommands: ["get", "describe", "apply", "delete", "logs", "exec", "project", "new-project", "whoami", "login"],
};
