import { CommandSpec } from "../../spec.types";

export const CARGO_AUDIT_FIG_SPEC: CommandSpec = {
    name: "cargo-audit",
    source: "fig",
    subcommands: ["audit", "bin", "help", "--db", "--file", "--ignore", "--json", "--target"],
};
