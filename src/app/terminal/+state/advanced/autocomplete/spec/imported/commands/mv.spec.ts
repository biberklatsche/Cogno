import { CommandSpec } from "../../spec.types";

export const MV_FIG_SPEC: CommandSpec = {
    name: "mv",
    source: "fig",
    subcommands: ["-v", "-f", "-i", "-n", "-u", "-T"],
};
