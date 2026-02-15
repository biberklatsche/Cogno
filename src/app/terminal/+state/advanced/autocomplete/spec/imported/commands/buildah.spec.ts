import { CommandSpec } from "../../spec.types";

export const BUILDAH_FIG_SPEC: CommandSpec = {
    name: "buildah",
    source: "fig",
    subcommands: ["from", "run", "commit", "bud", "images", "push", "pull", "mount", "umount", "tag"],
};
