import { CommandSpec } from "../../spec.types";

export const POETRY_FIG_SPEC: CommandSpec = {
    name: "poetry",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/poetry.ts",
    subcommands: [
        "add",
        "remove",
        "install",
        "update",
        "build",
        "publish",
        "run",
        "shell",
        "lock",
        "show",
        "config",
    ],
};

