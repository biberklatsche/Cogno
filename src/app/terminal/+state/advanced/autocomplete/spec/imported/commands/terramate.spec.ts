import { CommandSpec } from "../../spec.types";

export const TERRAMATE_FIG_SPEC: CommandSpec = {
    name: "terramate",
    source: "fig",
    subcommands: ["create", "run", "generate", "list", "fmt", "version", "experimental", "cloud"],
    subcommandOptions: {
        run: ["--changed", "--tags", "--no-tags", "--parallel", "--continue-on-error"],
        generate: ["--changed", "--tags", "--parallel", "--no-generate"],
        list: ["--changed", "--tags", "--no-tags", "--why"],
    },
};
