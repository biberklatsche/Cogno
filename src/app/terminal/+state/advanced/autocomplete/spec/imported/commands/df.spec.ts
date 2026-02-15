import { CommandSpec } from "../../spec.types";

export const DF_FIG_SPEC: CommandSpec = {
    name: "df",
    source: "fig",
    subcommands: ["-h", "-i", "-T", "-a", "--output"],
};
