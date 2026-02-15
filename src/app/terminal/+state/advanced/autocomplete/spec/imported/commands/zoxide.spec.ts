import { CommandSpec } from "../../spec.types";

export const ZOXIDE_FIG_SPEC: CommandSpec = {
    name: "zoxide",
    source: "fig",
    subcommands: ["add", "query", "remove", "import", "init"],
};

