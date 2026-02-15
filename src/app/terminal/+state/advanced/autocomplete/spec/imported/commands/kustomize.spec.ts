import { CommandSpec } from "../../spec.types";

export const KUSTOMIZE_FIG_SPEC: CommandSpec = {
    name: "kustomize",
    source: "fig",
    subcommands: ["build", "edit", "cfg", "create", "fn", "version"],
};

