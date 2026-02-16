import { CommandSpec } from "../../spec.types";

export const TSC_FIG_SPEC: CommandSpec = {
    name: "tsc",
    source: "fig",
    subcommands: ["--watch", "--project", "--build", "--noEmit", "--pretty", "--incremental", "--strict"],
    subcommandOptions: {
        "--build": ["--watch", "--clean", "--verbose", "--force"],
        "--project": ["--watch", "--pretty", "--incremental"],
    },
};
