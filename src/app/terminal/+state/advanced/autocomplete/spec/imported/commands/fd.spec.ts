import { CommandSpec } from "../../spec.types";

export const FD_FIG_SPEC: CommandSpec = {
    name: "fd",
    source: "fig",
    subcommands: ["--type", "--extension", "--hidden", "--follow", "--exclude", "--max-depth", "--full-path"],
};

