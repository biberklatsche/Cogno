import { CommandSpec } from "../../spec.types";

export const DOTNET_FIG_SPEC: CommandSpec = {
    name: "dotnet",
    source: "fig",
    subcommands: [
        "new",
        "build",
        "run",
        "test",
        "publish",
        "restore",
        "clean",
        "sln",
        "add",
        "remove",
        "tool",
    ],
};

