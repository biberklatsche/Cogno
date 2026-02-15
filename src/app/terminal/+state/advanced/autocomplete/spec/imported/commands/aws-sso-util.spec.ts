import { CommandSpec } from "../../spec.types";

export const AWS_SSO_UTIL_FIG_SPEC: CommandSpec = {
    name: "aws-sso-util",
    source: "fig",
    subcommands: ["configure", "login", "logout", "list-accounts", "check", "credential-process", "wrap"],
};
