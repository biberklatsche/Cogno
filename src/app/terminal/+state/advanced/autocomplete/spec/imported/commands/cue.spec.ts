import { CommandSpec } from "../../spec.types";

export const CUE_FIG_SPEC: CommandSpec = {
    name: "cue",
    source: "fig",
    subcommands: ["eval", "export", "fmt", "vet", "def", "import", "mod", "trim", "version"],
};
