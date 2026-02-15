import { CommandSpec } from "../../spec.types";

export const CODE_FIG_SPEC: CommandSpec = {
    name: "code",
    source: "fig",
    subcommands: ["--diff", "--new-window", "--reuse-window", "--wait", "--install-extension", "--list-extensions"],
};

