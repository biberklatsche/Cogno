import { CommandSpec } from "../../spec.types";

export const MISE_FIG_SPEC: CommandSpec = {
    name: "mise",
    source: "fig",
    subcommands: ["install", "use", "ls", "which", "env", "run", "settings", "trust", "doctor"],
    subcommandOptions: {
        install: ["node", "python", "go", "java", "--jobs", "--verbose"],
        use: ["-g", "-p", "--pin", "--fuzzy"],
        run: ["--raw", "--dry-run", "--continue-on-error"],
    },
};
