import { CommandSpec } from "../../spec.types";

export const CARGO_FIG_SPEC: CommandSpec = {
    name: "cargo",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/cargo.ts",
    subcommands: [
        "build",
        "run",
        "test",
        "check",
        "bench",
        "clean",
        "fmt",
        "clippy",
        "doc",
        "publish",
        "install",
        "update",
        "tree",
    ],
};

