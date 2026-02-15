import { CommandSpec } from "../../spec.types";

export const TILT_FIG_SPEC: CommandSpec = {
    name: "tilt",
    source: "fig",
    subcommands: ["up", "down", "ci", "doctor", "get", "api", "snapshot", "version"],
};
