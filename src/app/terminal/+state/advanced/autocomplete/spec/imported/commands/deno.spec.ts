import { CommandSpec } from "../../spec.types";

export const DENO_FIG_SPEC: CommandSpec = {
    name: "deno",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/deno.ts",
    subcommands: [
        "run",
        "test",
        "fmt",
        "lint",
        "task",
        "bundle",
        "compile",
        "cache",
        "doc",
        "info",
        "upgrade",
    ],
};

