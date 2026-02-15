import { CommandSpec } from "../../spec.types";

export const BTOP_FIG_SPEC: CommandSpec = {
    name: "btop",
    source: "fig",
    subcommands: ["--version", "--low-color", "--tty_on", "--debug"],
};
