import { CommandSpec } from "../../spec.types";

export const SELECT_STRING_FIG_SPEC: CommandSpec = {
    name: "Select-String",
    source: "fig",
    shells: ["PowerShell"],
    subcommands: ["-Pattern", "-Path", "-CaseSensitive", "-SimpleMatch", "-AllMatches", "-NotMatch"],
};
