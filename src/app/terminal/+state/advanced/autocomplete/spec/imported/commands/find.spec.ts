import { CommandSpec } from "../../spec.types";

export const FIND_FIG_SPEC: CommandSpec = {
    name: "find",
    source: "fig",
    subcommands: ["-name", "-type", "-maxdepth", "-mindepth", "-exec", "-print", "-delete"],
};
