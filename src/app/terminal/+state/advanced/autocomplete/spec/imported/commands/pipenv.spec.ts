import { CommandSpec } from "../../spec.types";

export const PIPENV_FIG_SPEC: CommandSpec = {
    name: "pipenv",
    source: "fig",
    subcommands: ["install", "uninstall", "update", "lock", "sync", "run", "shell", "check", "graph"],
};
