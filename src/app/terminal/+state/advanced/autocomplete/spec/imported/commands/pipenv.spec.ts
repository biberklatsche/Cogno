import { CommandSpec } from "../../spec.types";

export const PIPENV_FIG_SPEC: CommandSpec = {
    name: "pipenv",
    source: "fig",
    subcommands: ["install", "uninstall", "update", "lock", "sync", "run", "shell", "check", "graph"],
    subcommandOptions: {
        install: ["--dev", "--skip-lock", "--system", "--python", "--pre", "--deploy"],
        lock: ["--clear", "--pre", "--requirements", "--dev-only"],
        run: ["python", "pytest", "ruff", "mypy"],
    },
};
