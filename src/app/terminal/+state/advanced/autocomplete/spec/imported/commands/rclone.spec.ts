import { CommandSpec } from "../../spec.types";

export const RCLONE_FIG_SPEC: CommandSpec = {
    name: "rclone",
    source: "fig",
    subcommands: ["copy", "sync", "move", "ls", "lsf", "lsjson", "mount", "serve", "config", "about"],
    subcommandOptions: {
        copy: ["--progress", "--checksum", "--dry-run", "--transfers", "--checkers", "--exclude"],
        sync: ["--progress", "--dry-run", "--delete-excluded", "--transfers", "--checkers", "--exclude"],
        move: ["--progress", "--dry-run", "--delete-empty-src-dirs", "--transfers"],
        mount: ["--allow-other", "--vfs-cache-mode", "--daemon", "--read-only"],
    },
};
