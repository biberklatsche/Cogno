import { CommandSpec } from "../../spec.types";

export const UV_FIG_SPEC: CommandSpec = {
    name: "uv",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/uv.ts",
    subcommands: [
        "init",
        "add",
        "remove",
        "sync",
        "run",
        "python",
        "pip",
        "venv",
        "lock",
        "export",
    ],
};

