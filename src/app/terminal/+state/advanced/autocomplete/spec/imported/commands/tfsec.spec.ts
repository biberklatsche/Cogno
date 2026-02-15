import { CommandSpec } from "../../spec.types";

export const TFSEC_FIG_SPEC: CommandSpec = {
    name: "tfsec",
    source: "fig",
    subcommands: ["--format", "--minimum-severity", "--exclude", "--include-ignored", "--soft-fail", "--out", "--config-file"],
};
