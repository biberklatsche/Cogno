import { CommandSpec } from "../../spec.types";

export const DIG_FIG_SPEC: CommandSpec = {
    name: "dig",
    source: "fig",
    subcommands: ["+short", "+trace", "+dnssec", "@", "A", "AAAA", "MX", "TXT", "NS"],
};
