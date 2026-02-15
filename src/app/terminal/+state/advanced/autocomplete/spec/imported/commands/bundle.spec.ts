import { CommandSpec } from "../../spec.types";

export const BUNDLE_FIG_SPEC: CommandSpec = {
    name: "bundle",
    source: "fig",
    subcommands: ["install", "update", "exec", "add", "remove", "config", "outdated", "clean", "doctor"],
};

