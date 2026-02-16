import { CommandSpec } from "../../spec.types";

export const ESLINT_FIG_SPEC: CommandSpec = {
    name: "eslint",
    source: "fig",
    subcommands: ["--fix", "--cache", "--ext", "--config", "--max-warnings", "--format", "--quiet"],
    subcommandOptions: {
        "--fix": ["--cache", "--ext", "--config", "--max-warnings", "--format"],
        "--ext": [".js,.ts,.tsx", ".vue", ".svelte"],
    },
};
