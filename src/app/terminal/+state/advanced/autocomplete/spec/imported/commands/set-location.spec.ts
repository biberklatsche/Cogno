import { CommandSpec } from "../../spec.types";

export const SET_LOCATION_FIG_SPEC: CommandSpec = {
    name: "Set-Location",
    source: "fig",
    shells: ["PowerShell"],
    subcommands: ["-Path", "-LiteralPath", "-PassThru", "-StackName"],
};
