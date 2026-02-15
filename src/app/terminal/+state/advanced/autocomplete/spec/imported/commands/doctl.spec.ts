import { CommandSpec } from "../../spec.types";

export const DOCTL_FIG_SPEC: CommandSpec = {
    name: "doctl",
    source: "fig",
    subcommands: ["auth", "compute", "kubernetes", "databases", "apps", "serverless", "registry", "account"],
};
