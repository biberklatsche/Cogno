import { CommandSpec } from "../../spec.types";

export const RSYNC_FIG_SPEC: CommandSpec = {
    name: "rsync",
    source: "fig",
    subcommands: ["-a", "-v", "-z", "-h", "--progress", "--delete", "--exclude", "--include", "--dry-run"],
};

