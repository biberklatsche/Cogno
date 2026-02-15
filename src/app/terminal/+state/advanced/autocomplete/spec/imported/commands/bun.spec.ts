import { CommandSpec } from "../../spec.types";

export const BUN_FIG_SPEC: CommandSpec = {
    name: "bun",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/bun.ts",
    subcommands: [
        "run",
        "test",
        "install",
        "add",
        "remove",
        "update",
        "create",
        "build",
        "x",
        "pm",
    ],
};

