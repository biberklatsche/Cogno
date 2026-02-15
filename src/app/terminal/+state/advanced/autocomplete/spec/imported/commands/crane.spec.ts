import { CommandSpec } from "../../spec.types";

export const CRANE_FIG_SPEC: CommandSpec = {
    name: "crane",
    source: "fig",
    subcommands: ["ls", "digest", "manifest", "copy", "delete", "append", "config", "auth", "pull", "push"],
};
