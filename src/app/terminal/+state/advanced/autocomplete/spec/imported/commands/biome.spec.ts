import { CommandSpec } from "../../spec.types";

export const BIOME_FIG_SPEC: CommandSpec = {
    name: "biome",
    source: "fig",
    subcommands: ["check", "lint", "format", "ci", "init", "migrate", "rage", "version"],
};
