import { CommandSpec } from "../../spec.types";

export const CARGO_DENY_FIG_SPEC: CommandSpec = {
    name: "cargo-deny",
    source: "fig",
    subcommands: ["check", "fetch", "init", "list", "--all-features", "--workspace", "--manifest-path", "--config"],
};
