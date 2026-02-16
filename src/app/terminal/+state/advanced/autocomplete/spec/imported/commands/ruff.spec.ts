import { CommandSpec } from "../../spec.types";

export const RUFF_FIG_SPEC: CommandSpec = {
    name: "ruff",
    source: "fig",
    subcommands: ["check", "format", "rule", "config", "clean", "server", "analyze", "version"],
    subcommandOptions: {
        check: ["--fix", "--unsafe-fixes", "--select", "--ignore", "--extend-select", "--line-length", "--output-format"],
        format: ["--check", "--diff", "--line-length", "--target-version", "--preview"],
    },
};
