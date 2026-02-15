import { CommandSpec } from "../../spec.types";

export const NPX_FIG_SPEC: CommandSpec = {
    name: "npx",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/npx.ts",
    subcommands: ["--yes", "--package", "--node-options", "--call", "--ignore-existing"],
};

