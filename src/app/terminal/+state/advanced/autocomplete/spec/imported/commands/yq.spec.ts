import { CommandSpec } from "../../spec.types";

export const YQ_FIG_SPEC: CommandSpec = {
    name: "yq",
    source: "fig",
    subcommands: ["eval", "eval-all", "read", "write", "delete", "merge", "shell-completion"],
};

