import { CommandSpec } from "../../spec.types";

export const COMPOSER_FIG_SPEC: CommandSpec = {
    name: "composer",
    source: "fig",
    subcommands: [
        "install",
        "update",
        "require",
        "remove",
        "dump-autoload",
        "outdated",
        "show",
        "create-project",
        "run-script",
    ],
};

