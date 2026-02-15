import { CommandSpec } from "../../spec.types";

export const JQ_FIG_SPEC: CommandSpec = {
    name: "jq",
    source: "fig",
    subcommands: ["-r", "-c", "-s", "-R", "-n", "--arg", "--argjson", "--slurpfile", "--rawfile"],
};

