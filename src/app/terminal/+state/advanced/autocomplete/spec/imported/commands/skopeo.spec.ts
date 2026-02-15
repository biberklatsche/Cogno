import { CommandSpec } from "../../spec.types";

export const SKOPEO_FIG_SPEC: CommandSpec = {
    name: "skopeo",
    source: "fig",
    subcommands: ["copy", "inspect", "delete", "list-tags", "login", "logout", "sync", "manifest-digest"],
};
