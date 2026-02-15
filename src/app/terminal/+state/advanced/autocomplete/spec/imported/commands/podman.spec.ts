import { CommandSpec } from "../../spec.types";

export const PODMAN_FIG_SPEC: CommandSpec = {
    name: "podman",
    source: "fig",
    subcommands: ["run", "build", "ps", "images", "exec", "logs", "pull", "push", "rm", "rmi", "compose"],
};

