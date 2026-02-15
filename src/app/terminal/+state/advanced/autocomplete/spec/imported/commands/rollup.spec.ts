import { CommandSpec } from "../../spec.types";

export const ROLLUP_FIG_SPEC: CommandSpec = {
    name: "rollup",
    source: "fig",
    subcommands: ["-c", "-w", "-f", "-i", "-o", "--environment", "--plugin", "--bundleConfigAsCjs"],
};
