import { CommandSpec } from "../../spec.types";

export const PYENV_FIG_SPEC: CommandSpec = {
    name: "pyenv",
    source: "fig",
    subcommands: ["install", "uninstall", "versions", "global", "local", "shell", "rehash", "which", "doctor"],
    subcommandOptions: {
        install: ["-s", "-k", "-v", "--patch", "--list"],
        global: ["--unset"],
        local: ["--unset"],
    },
};
