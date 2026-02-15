import { CommandSpec } from "../../spec.types";

export const TOFU_FIG_SPEC: CommandSpec = {
    name: "tofu",
    source: "fig",
    subcommands: ["init", "plan", "apply", "destroy", "validate", "fmt", "providers", "state", "output"],
};
