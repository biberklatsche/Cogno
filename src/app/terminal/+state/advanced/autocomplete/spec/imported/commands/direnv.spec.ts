import { CommandSpec } from "../../spec.types";

export const DIRENV_FIG_SPEC: CommandSpec = {
    name: "direnv",
    source: "fig",
    subcommands: ["allow", "deny", "edit", "exec", "reload", "status", "stdlib", "version"],
    subcommandOptions: {
        exec: ["-s", "--", "bash", "zsh", "fish"],
        status: ["--json"],
    },
};
