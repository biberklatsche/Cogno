import { CommandSpec } from "../../spec.types";

export const RCLONE_FIG_SPEC: CommandSpec = {
    name: "rclone",
    source: "fig",
    subcommands: ["copy", "sync", "move", "ls", "lsf", "lsjson", "mount", "serve", "config", "about"],
};
