import { CommandSpec } from "../../spec.types";

export const FLYCTL_FIG_SPEC: CommandSpec = {
    name: "flyctl",
    source: "fig",
    subcommands: ["launch", "deploy", "status", "logs", "secrets", "scale", "apps", "ssh", "machine"],
};
