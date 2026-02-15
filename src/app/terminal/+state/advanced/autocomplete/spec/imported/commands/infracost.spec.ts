import { CommandSpec } from "../../spec.types";

export const INFRACOST_FIG_SPEC: CommandSpec = {
    name: "infracost",
    source: "fig",
    subcommands: ["breakdown", "diff", "output", "comment", "configure", "register", "auth", "upload", "version"],
};
