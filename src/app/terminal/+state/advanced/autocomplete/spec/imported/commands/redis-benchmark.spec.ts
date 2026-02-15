import { CommandSpec } from "../../spec.types";

export const REDIS_BENCHMARK_FIG_SPEC: CommandSpec = {
    name: "redis-benchmark",
    source: "fig",
    subcommands: ["-h", "-p", "-a", "-n", "-c", "-P", "-q", "-t", "--csv"],
};
