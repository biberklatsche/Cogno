import { CommandSpec } from "../../spec.types";

export const BIOME_FIG_SPEC: CommandSpec = {
    name: "biome",
    source: "fig",
    subcommands: ["check", "lint", "format", "ci", "init", "migrate", "rage", "version"],
    subcommandOptions: {
        check: ["--write", "--unsafe", "--formatter-enabled", "--linter-enabled", "--organize-imports-enabled", "--files-ignore-unknown"],
        lint: ["--write", "--unsafe", "--only", "--skip", "--diagnostic-level"],
        format: ["--write", "--indent-style", "--indent-width", "--line-width", "--quote-style"],
        ci: ["--formatter-enabled", "--linter-enabled", "--organize-imports-enabled", "--diagnostic-level"],
    },
};
