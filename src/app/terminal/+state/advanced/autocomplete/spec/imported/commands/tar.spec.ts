import { CommandSpec } from "../../spec.types";

export const TAR_FIG_SPEC: CommandSpec = {
    name: "tar",
    source: "fig",
    subcommands: ["-c", "-x", "-t", "-f", "-z", "-j", "-J", "-v", "--strip-components"],
};
