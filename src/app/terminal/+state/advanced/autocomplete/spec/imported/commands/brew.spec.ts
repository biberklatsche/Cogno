import { CommandSpec } from "../../spec.types";

export const BREW_FIG_SPEC: CommandSpec = {
    name: "brew",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/brew.ts",
    subcommands: [
        "install",
        "uninstall",
        "update",
        "upgrade",
        "list",
        "search",
        "info",
        "doctor",
        "cleanup",
        "tap",
        "untap",
        "services",
    ],
};

