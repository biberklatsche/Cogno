import { CommandSpec } from "../../spec.types";

export const KUBECTX_FIG_SPEC: CommandSpec = {
    name: "kubectx",
    source: "fig",
    subcommands: ["-", "-c", "-d", "-u"],
};
