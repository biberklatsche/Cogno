import { CommandSpec } from "../../spec.types";

export const FZF_FIG_SPEC: CommandSpec = {
    name: "fzf",
    source: "fig",
    subcommands: ["--multi", "--preview", "--height", "--layout", "--border", "--reverse", "--ansi", "--bind"],
};

