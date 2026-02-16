import { CommandSpec } from "../../spec.types";

export const NPM_FIG_SPEC: CommandSpec = {
    name: "npm",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/npm.ts",
    subcommands: [
        "run",
        "run-script",
        "test",
        "start",
        "build",
        "install",
        "ci",
        "publish",
        "exec",
        "create",
    ],
    options: [
        "--silent",
        "--json",
        "--workspaces",
        "--if-present",
        "--global",
        "--save-dev",
    ],
    providers: [
        {
            providerId: "npm-scripts",
            kind: "script",
            source: "npm-script",
            baseScore: 55,
            when: {
                firstArgIn: ["run", "run-script"],
                minArgs: 1,
            },
        },
    ],
    subcommandOptions: {
        run: ["--silent", "--if-present", "--workspace", "--workspaces"],
        "run-script": ["--silent", "--if-present", "--workspace", "--workspaces"],
        install: ["--save-dev", "--save-exact", "--global", "--legacy-peer-deps"],
        test: ["--watch", "--coverage"],
    },
};
