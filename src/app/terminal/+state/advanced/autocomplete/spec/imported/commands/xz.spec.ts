import { CommandSpec } from "../../spec.types";

export const XZ_FIG_SPEC: CommandSpec = {
    name: "xz",
    source: "fig",
    subcommands: ["-d", "-k", "-T", "-z", "-0", "-9"],
};
