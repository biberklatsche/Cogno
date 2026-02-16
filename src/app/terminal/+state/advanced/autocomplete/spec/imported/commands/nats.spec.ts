import { CommandSpec } from "../../spec.types";

export const NATS_FIG_SPEC: CommandSpec = {
    name: "nats",
    source: "fig",
    subcommands: ["pub", "sub", "req", "reply", "stream", "consumer", "kv", "object", "context", "server"],
    subcommandOptions: {
        pub: ["--server", "--headers", "--count", "--sleep", "--user", "--password"],
        sub: ["--server", "--queue", "--raw", "--count", "--user", "--password"],
        req: ["--server", "--replies", "--timeout", "--headers", "--user", "--password"],
        stream: ["add", "ls", "info", "rm", "edit", "report"],
        consumer: ["add", "ls", "info", "next", "rm", "edit"],
    },
};
