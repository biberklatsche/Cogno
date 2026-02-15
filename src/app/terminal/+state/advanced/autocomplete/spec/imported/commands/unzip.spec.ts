import { CommandSpec } from "../../spec.types";

export const UNZIP_FIG_SPEC: CommandSpec = {
    name: "unzip",
    source: "fig",
    subcommands: ["-l", "-t", "-d", "-o", "-n", "-q", "-x"],
};
