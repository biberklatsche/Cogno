import { CommandSpec } from "../../spec.types";

export const DU_FIG_SPEC: CommandSpec = {
    name: "du",
    source: "fig",
    subcommands: ["-h", "-s", "-d", "-a", "-c", "--max-depth"],
};
