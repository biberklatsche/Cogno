import { CommandSpec } from "../../spec.types";

export const PHP_FIG_SPEC: CommandSpec = {
    name: "php",
    source: "fig",
    subcommands: ["-v", "-m", "-i", "-r", "-S", "-d", "-f", "--ini", "-a"],
};

