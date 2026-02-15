import { CommandSpec } from "../../spec.types";

export const NERDCTL_FIG_SPEC: CommandSpec = {
    name: "nerdctl",
    source: "fig",
    subcommands: ["run", "build", "exec", "ps", "images", "pull", "push", "logs", "compose", "container"],
};
