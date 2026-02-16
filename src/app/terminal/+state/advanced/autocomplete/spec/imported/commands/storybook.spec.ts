import { CommandSpec } from "../../spec.types";

export const STORYBOOK_FIG_SPEC: CommandSpec = {
    name: "storybook",
    source: "fig",
    subcommands: ["dev", "build", "upgrade", "doctor", "migrate", "sandbox", "add", "remove"],
    subcommandOptions: {
        dev: ["-p", "--host", "--ci", "--smoke-test", "--no-open"],
        build: ["--output-dir", "--docs", "--test", "--quiet"],
    },
};
