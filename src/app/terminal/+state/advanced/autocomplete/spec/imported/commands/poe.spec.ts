import { CommandSpec } from "../../spec.types";

export const POE_FIG_SPEC: CommandSpec = {
    name: "poe",
    source: "fig",
    subcommands: ["--help", "--version", "-v", "-q", "-C", "--root", "--ansi", "--dry-run"],
};
