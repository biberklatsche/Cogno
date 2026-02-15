import { CommandSpec } from "../../spec.types";

export const TERRAFORM_FIG_SPEC: CommandSpec = {
    name: "terraform",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/terraform.ts",
    subcommands: [
        "init",
        "plan",
        "apply",
        "destroy",
        "validate",
        "fmt",
        "state",
        "output",
        "providers",
        "workspace",
        "taint",
        "untaint",
        "import",
    ],
};

