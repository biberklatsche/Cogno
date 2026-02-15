import { CommandSpec } from "../../spec.types";

export const TERRAMATE_FIG_SPEC: CommandSpec = {
    name: "terramate",
    source: "fig",
    subcommands: ["create", "run", "generate", "list", "fmt", "version", "experimental", "cloud"],
};
