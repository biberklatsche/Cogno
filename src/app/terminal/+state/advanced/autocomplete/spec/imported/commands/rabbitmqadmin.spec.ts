import { CommandSpec } from "../../spec.types";

export const RABBITMQADMIN_FIG_SPEC: CommandSpec = {
    name: "rabbitmqadmin",
    source: "fig",
    subcommands: ["list", "show", "declare", "delete", "publish", "get", "export", "import", "help"],
};
