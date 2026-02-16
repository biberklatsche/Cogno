import { CommandSpec } from "../../spec.types";

export const PNPM_FIG_SPEC: CommandSpec = {
    name: "pnpm",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/pnpm.ts",
    subcommands: ["run", "test", "install", "add", "remove", "update", "exec"],
    subcommandOptions: {
        run: ["--filter", "--recursive", "--parallel", "--stream"],
        install: ["--frozen-lockfile", "--prod", "--dev", "--workspace-root"],
        add: ["--save-dev", "--save-exact", "--workspace", "--filter"],
    },
};
