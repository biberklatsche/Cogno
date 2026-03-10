import { CommandSpec } from "../spec.types";

export function createCommandSpecsFixture(): CommandSpec[] {
    return [
        {
            name: "npm",
            subcommands: [
                {
                    name: "run",
                    args: { name: "script" },
                    providers: [{ providerId: "npm-scripts", source: "npm-script", baseScore: 60 }],
                },
            ],
        },
        {
            name: "yarn",
            providers: [
                {
                    providerId: "npm-scripts",
                    source: "npm-script",
                    baseScore: 60,
                    when: { maxArgs: 1 },
                },
            ],
            subcommands: [
                {
                    name: "run",
                    args: { name: "script" },
                    providers: [{ providerId: "npm-scripts", source: "npm-script", baseScore: 60 }],
                },
            ],
        },
        {
            name: "pnpm",
            subcommands: [
                {
                    name: "run",
                    args: { name: "script" },
                    providers: [{ providerId: "npm-scripts", source: "npm-script", baseScore: 60 }],
                },
            ],
        },
        {
            name: "git",
            subcommandOptions: {
                commit: ["-a", "-m"],
            },
        },
        {
            name: "Get-ChildItem",
            shells: ["PowerShell"],
        },
        {
            name: "docker",
        },
    ];
}

