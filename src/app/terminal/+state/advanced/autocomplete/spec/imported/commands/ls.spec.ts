import { CommandSpec } from "../../spec.types";

export const LS_FIG_SPEC: CommandSpec = {
    name: "ls",
    source: "fig",
    subcommands: ["-l", "-a", "-h", "-R", "-t", "-S", "-1", "--color", "-d"],
};

