import { CommandSpec } from "../../spec.types";

export const GZIP_FIG_SPEC: CommandSpec = {
    name: "gzip",
    source: "fig",
    subcommands: ["-d", "-k", "-r", "-v", "-1", "-9"],
};
