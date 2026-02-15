import { CommandSpec } from "../../spec.types";

export const KUBIE_FIG_SPEC: CommandSpec = {
    name: "kubie",
    source: "fig",
    subcommands: ["ctx", "ns", "exec", "info", "lint", "rename-context", "export", "completion"],
};
