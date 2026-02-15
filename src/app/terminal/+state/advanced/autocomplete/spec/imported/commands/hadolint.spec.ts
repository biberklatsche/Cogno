import { CommandSpec } from "../../spec.types";

export const HADOLINT_FIG_SPEC: CommandSpec = {
    name: "hadolint",
    source: "fig",
    subcommands: ["--config", "--format", "--failure-threshold", "--ignore", "--trusted-registry", "--verbose", "--no-color"],
};
