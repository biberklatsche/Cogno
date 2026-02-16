import { CommandSpec } from "../../spec.types";

export const YARN_FIG_SPEC: CommandSpec = {
    name: "yarn",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/yarn.ts",
    subcommands: ["run", "test", "install", "add", "remove", "up", "dlx"],
    subcommandOptions: {
        run: ["--silent", "--inspect", "--top-level"],
        install: ["--immutable", "--mode", "--check-cache"],
        add: ["-D", "-E", "-T", "--peer", "--optional"],
    },
};
