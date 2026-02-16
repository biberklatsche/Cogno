import { CommandSpec } from "../../spec.types";

export const PROMTOOL_FIG_SPEC: CommandSpec = {
    name: "promtool",
    source: "fig",
    subcommands: ["check", "query", "debug", "test", "tsdb", "promql", "rules", "metrics"],
    subcommandOptions: {
        check: ["config", "rules", "metrics", "web-config"],
        query: ["instant", "range", "--url", "--time", "--timeout"],
        test: ["rules", "--junit", "--run", "--debug"],
    },
};
