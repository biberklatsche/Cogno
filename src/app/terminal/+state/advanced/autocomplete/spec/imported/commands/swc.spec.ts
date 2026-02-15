import { CommandSpec } from "../../spec.types";

export const SWC_FIG_SPEC: CommandSpec = {
    name: "swc",
    source: "fig",
    subcommands: ["--config-file", "--source-maps", "--watch", "--out-dir", "--out-file", "--copy-files"],
};
