import { CommandSpec } from "../../spec.types";

export const SAML2AWS_FIG_SPEC: CommandSpec = {
    name: "saml2aws",
    source: "fig",
    subcommands: ["login", "configure", "list-roles", "script", "exec", "help", "version"],
};
