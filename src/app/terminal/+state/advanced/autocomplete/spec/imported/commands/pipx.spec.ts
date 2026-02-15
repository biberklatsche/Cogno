import { CommandSpec } from "../../spec.types";

export const PIPX_FIG_SPEC: CommandSpec = {
    name: "pipx",
    source: "fig",
    subcommands: ["install", "uninstall", "run", "runpip", "inject", "upgrade", "upgrade-all", "list", "ensurepath"],
};
