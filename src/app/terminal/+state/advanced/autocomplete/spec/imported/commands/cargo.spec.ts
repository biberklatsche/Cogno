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
    subcommandOptions: {
        run: ["--release", "--bin", "--example", "--features"],
        build: ["--release", "--workspace", "--target", "--features"],
        test: ["--release", "--workspace", "--package", "-- --nocapture"],
    },
};
