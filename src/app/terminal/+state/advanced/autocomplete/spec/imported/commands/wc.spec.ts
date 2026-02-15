import { CommandSpec } from "../../spec.types";

export const WC_FIG_SPEC: CommandSpec = {
    name: "wc",
    source: "fig",
    subcommands: ["-l", "-w", "-c", "-m", "-L"],
};
