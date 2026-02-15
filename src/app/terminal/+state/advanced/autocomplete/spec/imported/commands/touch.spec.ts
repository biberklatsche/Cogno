import { CommandSpec } from "../../spec.types";

export const TOUCH_FIG_SPEC: CommandSpec = {
    name: "touch",
    source: "fig",
    subcommands: ["-a", "-m", "-c", "-d", "-r", "-t"],
};
