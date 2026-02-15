import { CommandSpec } from "../../spec.types";

export const EKSCTL_FIG_SPEC: CommandSpec = {
    name: "eksctl",
    source: "fig",
    subcommands: ["create", "delete", "get", "utils", "upgrade", "scale", "drain"],
};
