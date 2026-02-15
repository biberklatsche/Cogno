import { CommandSpec } from "../../spec.types";

export const UNIQ_FIG_SPEC: CommandSpec = {
    name: "uniq",
    source: "fig",
    subcommands: ["-c", "-d", "-u", "-i", "-f", "-s", "-w"],
};
