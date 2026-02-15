import { CommandSpec } from "../../spec.types";

export const INVOKE_WEBREQUEST_FIG_SPEC: CommandSpec = {
    name: "Invoke-WebRequest",
    source: "fig",
    shells: ["PowerShell"],
    subcommands: ["-Uri", "-Method", "-Headers", "-Body", "-OutFile", "-UseBasicParsing", "-TimeoutSec"],
};
