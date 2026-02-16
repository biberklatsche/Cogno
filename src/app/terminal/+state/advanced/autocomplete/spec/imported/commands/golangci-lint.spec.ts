import { CommandSpec } from "../../spec.types";

export const GOLANGCI_LINT_FIG_SPEC: CommandSpec = {
    name: "golangci-lint",
    source: "fig",
    subcommands: ["run", "cache", "config", "completion", "linters", "formatters", "version", "help"],
    subcommandOptions: {
        run: ["--fix", "--out-format", "--timeout", "--config", "--enable", "--disable", "--build-tags"],
        cache: ["status", "clean"],
        linters: ["--json", "--enable-all", "--fast"],
    },
};
