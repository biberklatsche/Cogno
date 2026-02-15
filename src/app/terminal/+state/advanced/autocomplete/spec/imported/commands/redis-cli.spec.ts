import { CommandSpec } from "../../spec.types";

export const REDIS_CLI_FIG_SPEC: CommandSpec = {
    name: "redis-cli",
    source: "fig",
    subcommands: ["-h", "-p", "-a", "--tls", "PING", "GET", "SET", "DEL", "KEYS", "HGETALL", "INFO"],
};

