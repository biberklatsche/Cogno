import { CommandSpec } from "../../spec.types";

export const BANDIT_FIG_SPEC: CommandSpec = {
    name: "bandit",
    source: "fig",
    subcommands: ["-r", "-c", "-f", "-o", "-s", "-t", "-ll", "-iii", "--ini"],
};
