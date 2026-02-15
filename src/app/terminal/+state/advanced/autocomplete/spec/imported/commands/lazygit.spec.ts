import { CommandSpec } from "../../spec.types";

export const LAZYGIT_FIG_SPEC: CommandSpec = {
    name: "lazygit",
    source: "fig",
    subcommands: ["--path", "--use-config-file", "--debug", "--version"],
};
