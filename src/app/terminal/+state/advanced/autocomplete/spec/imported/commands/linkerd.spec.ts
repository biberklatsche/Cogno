import { CommandSpec } from "../../spec.types";

export const LINKERD_FIG_SPEC: CommandSpec = {
    name: "linkerd",
    source: "fig",
    subcommands: ["install", "check", "upgrade", "inject", "viz", "multicluster", "jaeger", "completion"],
};
