import { CommandSpec } from "../../spec.types";

export const GITLEAKS_FIG_SPEC: CommandSpec = {
    name: "gitleaks",
    source: "fig",
    subcommands: ["detect", "protect", "git", "dir", "stdin", "version", "--config", "--report-format"],
};
