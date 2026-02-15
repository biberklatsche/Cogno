import { CommandSpec } from "../../spec.types";

export const RG_FIG_SPEC: CommandSpec = {
    name: "rg",
    source: "fig",
    subcommands: ["--files", "--hidden", "-g", "-t", "-T", "-S", "-i", "-n", "--json", "--stats"],
};

