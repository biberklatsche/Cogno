import { CommandSpec } from "../../spec.types";

export const CARGO_NEXTEST_FIG_SPEC: CommandSpec = {
    name: "cargo-nextest",
    source: "fig",
    subcommands: ["run", "archive", "show-config", "list", "self", "--profile", "--workspace", "--all-targets"],
};
