import { CommandSpec } from "../../spec.types";

export const VAULT_FIG_SPEC: CommandSpec = {
    name: "vault",
    source: "fig",
    subcommands: [
        "server",
        "status",
        "login",
        "logout",
        "kv",
        "secrets",
        "auth",
        "policy",
        "token",
        "write",
        "read",
        "list",
    ],
};

