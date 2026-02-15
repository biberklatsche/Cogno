import { CommandSpec } from "../../spec.types";

export const GET_CHILDITEM_FIG_SPEC: CommandSpec = {
    name: "Get-ChildItem",
    source: "fig",
    shells: ["PowerShell"],
    subcommands: ["-Path", "-Recurse", "-Force", "-Filter", "-File", "-Directory", "-Hidden"],
};
