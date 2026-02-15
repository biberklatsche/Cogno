import { CommandSpec } from "../../spec.types";

export const GOLANGCI_LINT_FIG_SPEC: CommandSpec = {
    name: "golangci-lint",
    source: "fig",
    subcommands: ["run", "cache", "config", "completion", "linters", "formatters", "version", "help"],
};
