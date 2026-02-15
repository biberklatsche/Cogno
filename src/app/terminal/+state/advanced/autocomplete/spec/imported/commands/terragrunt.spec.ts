import { CommandSpec } from "../../spec.types";

export const TERRAGRUNT_FIG_SPEC: CommandSpec = {
    name: "terragrunt",
    source: "fig",
    subcommands: ["run-all", "hclfmt", "validate-inputs", "plan", "apply", "destroy", "output"],
};
