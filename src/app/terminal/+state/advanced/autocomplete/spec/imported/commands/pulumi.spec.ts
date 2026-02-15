import { CommandSpec } from "../../spec.types";

export const PULUMI_FIG_SPEC: CommandSpec = {
    name: "pulumi",
    source: "fig",
    subcommands: [
        "up",
        "preview",
        "destroy",
        "stack",
        "config",
        "login",
        "logout",
        "plugin",
        "new",
        "refresh",
    ],
};

