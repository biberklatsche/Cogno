import { CommandSpec } from "../../spec.types";

export const ZSTD_FIG_SPEC: CommandSpec = {
    name: "zstd",
    source: "fig",
    subcommands: ["-d", "-k", "-T", "-q", "-v", "-1", "-19"],
};
