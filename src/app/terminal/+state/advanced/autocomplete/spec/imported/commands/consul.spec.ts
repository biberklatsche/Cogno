import { CommandSpec } from "../../spec.types";

export const CONSUL_FIG_SPEC: CommandSpec = {
    name: "consul",
    source: "fig",
    subcommands: [
        "agent",
        "catalog",
        "connect",
        "event",
        "exec",
        "info",
        "join",
        "leave",
        "kv",
        "members",
        "monitor",
        "operator",
        "snapshot",
    ],
};

