import { CommandSpec } from "../../spec.types";

export const VITEST_FIG_SPEC: CommandSpec = {
    name: "vitest",
    source: "fig",
    subcommands: ["run", "watch", "bench", "--coverage", "--ui", "--reporter", "--threads", "--testNamePattern"],
    subcommandOptions: {
        run: ["--coverage", "--reporter", "--threads", "--watch=false"],
        watch: ["--coverage", "--ui", "--reporter", "--threads"],
    },
};
