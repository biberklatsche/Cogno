import { CommandSpec } from "../../spec.types";

export const SAML2AWS_FIG_SPEC: CommandSpec = {
    name: "saml2aws",
    source: "fig",
    subcommands: ["login", "configure", "list-roles", "script", "exec", "help", "version"],
    subcommandOptions: {
        login: ["--profile", "--skip-prompt", "--force", "--session-duration", "--role", "--url"],
        exec: ["--profile", "--exec-profile", "--session-duration", "--", "aws", "bash"],
    },
};
