import { CommandSpec } from "../../spec.types";

export const KUBEVAL_FIG_SPEC: CommandSpec = {
    name: "kubeval",
    source: "fig",
    subcommands: ["--strict", "--ignore-missing-schemas", "--schema-location", "--kubernetes-version", "--output", "--quiet"],
};
