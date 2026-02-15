import { CommandSpec } from "../../spec.types";

export const KUBENS_FIG_SPEC: CommandSpec = {
    name: "kubens",
    source: "fig",
    subcommands: ["-", "-c", "-d"],
};
