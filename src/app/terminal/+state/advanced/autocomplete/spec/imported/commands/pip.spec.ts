import { CommandSpec } from "../../spec.types";

export const PIP_FIG_SPEC: CommandSpec = {
    name: "pip",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/pip.ts",
    subcommands: [
        "install",
        "uninstall",
        "list",
        "show",
        "freeze",
        "check",
        "download",
        "cache",
        "config",
        "index",
    ],
};

