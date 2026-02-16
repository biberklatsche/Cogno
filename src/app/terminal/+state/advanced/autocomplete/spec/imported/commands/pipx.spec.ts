import { CommandSpec } from "../../spec.types";

export const PIPX_FIG_SPEC: CommandSpec = {
    name: "pipx",
    source: "fig",
    subcommands: ["install", "uninstall", "run", "runpip", "inject", "upgrade", "upgrade-all", "list", "ensurepath"],
    subcommandOptions: {
        install: ["--python", "--include-deps", "--force", "--suffix"],
        run: ["--python", "--spec", "--pip-args"],
        inject: ["--include-apps", "--include-deps", "--force"],
    },
};
