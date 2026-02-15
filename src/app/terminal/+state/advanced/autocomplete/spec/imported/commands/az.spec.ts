import { CommandSpec } from "../../spec.types";

export const AZ_FIG_SPEC: CommandSpec = {
    name: "az",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/az.ts",
    subcommands: [
        "login",
        "account",
        "group",
        "vm",
        "aks",
        "acr",
        "appservice",
        "deployment",
        "webapp",
        "functionapp",
    ],
};

