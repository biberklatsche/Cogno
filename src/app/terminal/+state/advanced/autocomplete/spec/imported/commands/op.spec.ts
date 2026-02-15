import { CommandSpec } from "../../spec.types";

export const OP_FIG_SPEC: CommandSpec = {
    name: "op",
    source: "fig",
    subcommands: ["signin", "signout", "account", "item", "vault", "read", "run", "inject", "whoami"],
};

