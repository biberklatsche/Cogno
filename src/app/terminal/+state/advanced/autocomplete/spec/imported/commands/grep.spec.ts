import { CommandSpec } from "../../spec.types";

export const GREP_FIG_SPEC: CommandSpec = {
    name: "grep",
    source: "fig",
    subcommands: ["-r", "-R", "-i", "-n", "-v", "-E", "-F", "-w", "--color"],
};
