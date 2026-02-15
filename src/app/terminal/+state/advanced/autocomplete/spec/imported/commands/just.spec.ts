import { CommandSpec } from "../../spec.types";

export const JUST_FIG_SPEC: CommandSpec = {
    name: "just",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/just.ts",
    subcommands: ["--list", "--summary", "--show", "--dry-run", "--choose", "--set", "--shell"],
};

