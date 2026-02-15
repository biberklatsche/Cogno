import { CommandSpec } from "../../spec.types";

export const SEMGREP_FIG_SPEC: CommandSpec = {
    name: "semgrep",
    source: "fig",
    subcommands: ["scan", "ci", "login", "logout", "publish", "show", "lsp", "install-semgrep-pro"],
};
