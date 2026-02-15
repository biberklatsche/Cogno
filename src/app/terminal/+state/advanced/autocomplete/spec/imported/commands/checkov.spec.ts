import { CommandSpec } from "../../spec.types";

export const CHECKOV_FIG_SPEC: CommandSpec = {
    name: "checkov",
    source: "fig",
    subcommands: ["-d", "-f", "--framework", "--check", "--skip-check", "--soft-fail", "-o", "--compact"],
};
