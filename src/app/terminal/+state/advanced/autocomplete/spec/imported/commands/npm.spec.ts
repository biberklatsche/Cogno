import { CommandSpec } from "../../spec.types";

export const NPM_FIG_SPEC: CommandSpec = {
    name: "npm",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/npm.ts",
    subcommands: [
        {
            name: "run",
            args: { name: "script" },
            providers: [
                {
                    providerId: "npm-scripts",
                    kind: "script",
                    source: "npm-script",
                    baseScore: 55,
                },
            ],
        },
        {
            name: "run-script",
            args: { name: "script" },
            providers: [
                {
                    providerId: "npm-scripts",
                    kind: "script",
                    source: "npm-script",
                    baseScore: 55,
                },
            ],
        },
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
    subcommandOptions: {
        run: ["--silent", "--if-present", "--workspace", "--workspaces"],
        "run-script": ["--silent", "--if-present", "--workspace", "--workspaces"],
        install: ["--save-dev", "--save-exact", "--global", "--legacy-peer-deps"],
        test: ["--watch", "--coverage"],
    },
};
