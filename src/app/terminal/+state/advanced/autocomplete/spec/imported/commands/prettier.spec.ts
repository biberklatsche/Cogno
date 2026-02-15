import { CommandSpec } from "../../spec.types";

export const PRETTIER_FIG_SPEC: CommandSpec = {
    name: "prettier",
    source: "fig",
    subcommands: ["--write", "--check", "--list-different", "--config", "--ignore-path", "--plugin", "--stdin-filepath"],
};
