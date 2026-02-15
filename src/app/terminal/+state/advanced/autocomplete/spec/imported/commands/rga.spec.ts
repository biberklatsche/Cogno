import { CommandSpec } from "../../spec.types";

export const RGA_FIG_SPEC: CommandSpec = {
    name: "rga",
    source: "fig",
    subcommands: ["--files-with-matches", "--glob", "--ignore-case", "--stats", "--max-count", "--hidden", "--sort-files"],
};
