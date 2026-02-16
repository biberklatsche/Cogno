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
    subcommandOptions: {
        vm: ["list", "show", "create", "delete", "start", "stop", "--resource-group", "--name", "--image"],
        aks: ["list", "show", "get-credentials", "create", "delete", "--resource-group", "--name"],
        account: ["show", "set", "list", "--subscription"],
    },
};
