import { CommandSpec } from "../../spec.types";

export const AWS_VAULT_FIG_SPEC: CommandSpec = {
    name: "aws-vault",
    source: "fig",
    subcommands: ["exec", "add", "list", "login", "remove", "rotate", "clear", "help"],
    subcommandOptions: {
        exec: ["--duration", "--region", "--profile", "--debug", "--server"],
        login: ["--duration", "--region", "--stdout", "--no-session"],
        add: ["--env", "--no-session", "--prompt"],
    },
};
