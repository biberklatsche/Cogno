import { CommandSpec } from "../../spec.types";

export const K9S_FIG_SPEC: CommandSpec = {
    name: "k9s",
    source: "fig",
    subcommands: ["--context", "--namespace", "--readonly", "--headless", "--command", "--logLevel"],
};

