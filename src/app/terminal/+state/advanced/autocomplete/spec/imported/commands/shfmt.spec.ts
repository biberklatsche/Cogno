import { CommandSpec } from "../../spec.types";

export const SHFMT_FIG_SPEC: CommandSpec = {
    name: "shfmt",
    source: "fig",
    subcommands: ["-w", "-d", "-i", "-ci", "-bn", "-mn", "-sr", "-ln"],
};
