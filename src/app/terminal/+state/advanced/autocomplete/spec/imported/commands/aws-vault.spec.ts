import { CommandSpec } from "../../spec.types";

export const AWS_VAULT_FIG_SPEC: CommandSpec = {
    name: "aws-vault",
    source: "fig",
    subcommands: ["exec", "add", "list", "login", "remove", "rotate", "clear", "help"],
};
