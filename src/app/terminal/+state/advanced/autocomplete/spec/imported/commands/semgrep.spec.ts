import { CommandSpec } from "../../spec.types";

export const SEMGREP_FIG_SPEC: CommandSpec = {
    name: "semgrep",
    source: "fig",
    subcommands: ["scan", "ci", "login", "logout", "publish", "show", "lsp", "install-semgrep-pro"],
    subcommandOptions: {
        scan: ["--config", "--exclude", "--include", "--severity", "--json", "--sarif", "--error", "--quiet"],
        ci: ["--config", "--json", "--sarif", "--error", "--suppress-errors", "--exclude"],
    },
};
