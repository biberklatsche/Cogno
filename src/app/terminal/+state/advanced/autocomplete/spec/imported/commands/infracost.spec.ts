import { CommandSpec } from "../../spec.types";

export const INFRACOST_FIG_SPEC: CommandSpec = {
    name: "infracost",
    source: "fig",
    subcommands: ["breakdown", "diff", "output", "comment", "configure", "register", "auth", "upload", "version"],
    subcommandOptions: {
        breakdown: ["--path", "--format", "--out-file", "--show-skipped", "--terraform-plan-flags"],
        diff: ["--path", "--compare-to", "--format", "--out-file"],
        output: ["--path", "--format", "--fields", "--show-skipped"],
    },
};
