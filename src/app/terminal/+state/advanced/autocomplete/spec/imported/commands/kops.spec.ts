import { CommandSpec } from "../../spec.types";

export const KOPS_FIG_SPEC: CommandSpec = {
    name: "kops",
    source: "fig",
    subcommands: ["create", "update", "delete", "validate", "rolling-update", "replace", "export", "get", "toolbox"],
};
