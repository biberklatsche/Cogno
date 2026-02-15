import { CommandSpec } from "../../spec.types";

export const PACKER_FIG_SPEC: CommandSpec = {
    name: "packer",
    source: "fig",
    subcommands: ["init", "fmt", "validate", "build", "inspect", "plugins", "version"],
};

