import { CommandSpec } from "../../spec.types";

export const TEMPO_FIG_SPEC: CommandSpec = {
    name: "tempo",
    source: "fig",
    subcommands: ["-config.file", "-config.expand-env", "-target", "-log.level", "-mem-ballast-size-mbs"],
};
