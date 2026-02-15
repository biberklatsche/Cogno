import { CommandSpec } from "../../spec.types";

export const RUFF_FIG_SPEC: CommandSpec = {
    name: "ruff",
    source: "fig",
    subcommands: ["check", "format", "rule", "config", "clean", "server", "analyze", "version"],
};
