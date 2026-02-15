import { CommandSpec } from "../../spec.types";

export const KREW_FIG_SPEC: CommandSpec = {
    name: "krew",
    source: "fig",
    subcommands: ["install", "uninstall", "update", "upgrade", "list", "search", "index", "info", "version"],
};
