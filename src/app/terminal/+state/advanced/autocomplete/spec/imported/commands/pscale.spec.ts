import { CommandSpec } from "../../spec.types";

export const PSCALE_FIG_SPEC: CommandSpec = {
    name: "pscale",
    source: "fig",
    subcommands: ["auth", "org", "database", "branch", "deploy-request", "shell", "connect", "password", "version"],
};
