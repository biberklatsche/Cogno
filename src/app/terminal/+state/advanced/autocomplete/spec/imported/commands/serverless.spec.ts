import { CommandSpec } from "../../spec.types";

export const SERVERLESS_FIG_SPEC: CommandSpec = {
    name: "serverless",
    source: "fig",
    subcommands: [
        "deploy",
        "remove",
        "invoke",
        "invoke local",
        "offline",
        "logs",
        "info",
        "print",
        "package",
    ],
};

