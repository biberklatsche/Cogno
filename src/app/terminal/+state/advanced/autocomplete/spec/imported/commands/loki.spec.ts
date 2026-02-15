import { CommandSpec } from "../../spec.types";

export const LOKI_FIG_SPEC: CommandSpec = {
    name: "loki",
    source: "fig",
    subcommands: ["-config.file", "-config.expand-env", "-log.level", "-target", "-print-config-stderr"],
};
