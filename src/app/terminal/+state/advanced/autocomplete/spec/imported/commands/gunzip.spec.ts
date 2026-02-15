import { CommandSpec } from "../../spec.types";

export const GUNZIP_FIG_SPEC: CommandSpec = {
    name: "gunzip",
    source: "fig",
    subcommands: ["-k", "-r", "-v", "-f", "-t"],
};
