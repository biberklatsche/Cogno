import { CommandSpec } from "../../spec.types";

export const ACT_FIG_SPEC: CommandSpec = {
    name: "act",
    source: "fig",
    subcommands: ["--list", "--job", "--eventpath", "--watch", "--secret-file", "--env-file", "--container-architecture"],
};
