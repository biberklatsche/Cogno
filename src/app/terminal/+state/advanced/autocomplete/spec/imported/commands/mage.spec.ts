import { CommandSpec } from "../../spec.types";

export const MAGE_FIG_SPEC: CommandSpec = {
    name: "mage",
    source: "fig",
    subcommands: ["-l", "-h", "-v", "-w", "-compile", "-clean", "-keep", "-d", "-f"],
};
