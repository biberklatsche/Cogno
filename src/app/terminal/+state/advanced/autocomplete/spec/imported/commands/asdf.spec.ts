import { CommandSpec } from "../../spec.types";

export const ASDF_FIG_SPEC: CommandSpec = {
    name: "asdf",
    source: "fig",
    subcommands: ["plugin", "install", "uninstall", "list", "global", "local", "current", "reshim", "where"],
};
