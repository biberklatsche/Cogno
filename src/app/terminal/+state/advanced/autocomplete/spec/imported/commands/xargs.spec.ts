import { CommandSpec } from "../../spec.types";

export const XARGS_FIG_SPEC: CommandSpec = {
    name: "xargs",
    source: "fig",
    subcommands: ["-0", "-I", "-n", "-P", "-r", "-t"],
};
