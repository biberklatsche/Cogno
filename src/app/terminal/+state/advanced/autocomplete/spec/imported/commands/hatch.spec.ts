import { CommandSpec } from "../../spec.types";

export const HATCH_FIG_SPEC: CommandSpec = {
    name: "hatch",
    source: "fig",
    subcommands: ["new", "run", "env", "python", "build", "publish", "version", "shell", "status"],
    subcommandOptions: {
        run: ["test", "lint", "format", "--env", "--verbose"],
        env: ["create", "show", "remove", "prune", "find"],
        build: ["-t", "--hooks-only", "--clean", "--verbose"],
    },
};
