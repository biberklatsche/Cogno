import { CommandSpec } from "../../spec.types";

export const NOMAD_FIG_SPEC: CommandSpec = {
    name: "nomad",
    source: "fig",
    subcommands: [
        "job",
        "node",
        "alloc",
        "agent",
        "status",
        "run",
        "stop",
        "plan",
        "eval",
        "operator",
    ],
};

