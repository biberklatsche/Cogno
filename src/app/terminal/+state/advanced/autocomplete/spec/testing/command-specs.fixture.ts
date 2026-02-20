import { CommandSpec } from "../spec.types";
import { importFigSubsetSpecs } from "../importer/fig-lite.importer";

export function createCommandSpecsFixture(): CommandSpec[] {
    return importFigSubsetSpecs([
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
    ]);
}

