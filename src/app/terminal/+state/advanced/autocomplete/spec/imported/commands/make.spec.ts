import { CommandSpec } from "../../spec.types";

export const MAKE_FIG_SPEC: CommandSpec = {
    name: "make",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/make.ts",
    subcommands: [
        "-f",
        "-C",
        "-j",
        "-k",
        "-n",
        "-B",
        "--dry-run",
        "--always-make",
    ],
};

