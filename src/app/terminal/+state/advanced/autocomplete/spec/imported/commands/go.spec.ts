import { CommandSpec } from "../../spec.types";

export const GO_FIG_SPEC: CommandSpec = {
    name: "go",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/go.ts",
    subcommands: [
        "build",
        "run",
        "test",
        "mod",
        "work",
        "fmt",
        "vet",
        "clean",
        "install",
        "list",
        "env",
        "version",
    ],
    subcommandOptions: {
        test: ["./...", "-run", "-count", "-cover", "-v"],
        build: ["./...", "-o", "-tags", "-race"],
        run: ["./...", "-exec"],
    },
};
