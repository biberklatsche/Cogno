import { CommandSpec } from "../../spec.types";

export const GET_CONTENT_FIG_SPEC: CommandSpec = {
    name: "Get-Content",
    source: "fig",
    shells: ["PowerShell"],
    subcommands: ["-Path", "-TotalCount", "-Tail", "-Wait", "-Raw", "-Encoding", "-Delimiter"],
};
