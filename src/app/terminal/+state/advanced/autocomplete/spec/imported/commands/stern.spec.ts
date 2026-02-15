import { CommandSpec } from "../../spec.types";

export const STERN_FIG_SPEC: CommandSpec = {
    name: "stern",
    source: "fig",
    subcommands: ["--namespace", "--all-namespaces", "--selector", "--container", "--since", "--tail", "--follow", "--timestamps"],
};
