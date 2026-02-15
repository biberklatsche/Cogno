import { CommandSpec } from "../../spec.types";

export const CODE_INSIDERS_FIG_SPEC: CommandSpec = {
    name: "code-insiders",
    source: "fig",
    subcommands: ["--diff", "--new-window", "--reuse-window", "--wait", "--install-extension", "--list-extensions"],
};

