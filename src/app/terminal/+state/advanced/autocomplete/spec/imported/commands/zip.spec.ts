import { CommandSpec } from "../../spec.types";

export const ZIP_FIG_SPEC: CommandSpec = {
    name: "zip",
    source: "fig",
    subcommands: ["-r", "-q", "-9", "-0", "-x", "-i", "-u", "-d"],
};
