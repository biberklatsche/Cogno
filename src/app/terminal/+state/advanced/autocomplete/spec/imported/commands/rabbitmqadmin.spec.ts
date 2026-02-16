import { CommandSpec } from "../../spec.types";

export const RABBITMQADMIN_FIG_SPEC: CommandSpec = {
    name: "rabbitmqadmin",
    source: "fig",
    subcommands: ["list", "show", "declare", "delete", "publish", "get", "export", "import", "help"],
    subcommandOptions: {
        list: ["queues", "exchanges", "bindings", "users", "vhosts", "--vhost", "--format"],
        declare: ["queue", "exchange", "binding", "--vhost", "--durable", "--auto_delete"],
        delete: ["queue", "exchange", "binding", "--vhost", "--if-empty", "--if-unused"],
    },
};
