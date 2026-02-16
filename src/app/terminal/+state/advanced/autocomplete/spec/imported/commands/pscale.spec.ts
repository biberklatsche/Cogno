import { CommandSpec } from "../../spec.types";

export const PSCALE_FIG_SPEC: CommandSpec = {
    name: "pscale",
    source: "fig",
    subcommands: ["auth", "org", "database", "branch", "deploy-request", "shell", "connect", "password", "version"],
    subcommandOptions: {
        auth: ["login", "logout"],
        database: ["create", "list", "delete", "show"],
        branch: ["create", "list", "delete", "show", "promote"],
        "deploy-request": ["create", "list", "show", "approve", "close"],
    },
};
