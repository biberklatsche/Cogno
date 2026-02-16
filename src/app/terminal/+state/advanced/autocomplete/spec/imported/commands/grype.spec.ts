import { CommandSpec } from "../../spec.types";

export const GRYPE_FIG_SPEC: CommandSpec = {
    name: "grype",
    source: "fig",
    subcommands: ["db", "completion", "version", "help", "-o", "--scope", "--fail-on", "--only-fixed"],
    subcommandOptions: {
        db: ["status", "check", "list", "update", "--only-update", "--add-cpes-if-none"],
        "-o": ["table", "json", "cyclonedx", "sarif", "spdx-json"],
    },
};
