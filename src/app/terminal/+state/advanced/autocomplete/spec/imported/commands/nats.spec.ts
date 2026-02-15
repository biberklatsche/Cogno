import { CommandSpec } from "../../spec.types";

export const NATS_FIG_SPEC: CommandSpec = {
    name: "nats",
    source: "fig",
    subcommands: ["pub", "sub", "req", "reply", "stream", "consumer", "kv", "object", "context", "server"],
};
