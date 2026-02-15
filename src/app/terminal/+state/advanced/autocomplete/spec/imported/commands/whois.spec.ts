import { CommandSpec } from "../../spec.types";

export const WHOIS_FIG_SPEC: CommandSpec = {
    name: "whois",
    source: "fig",
    subcommands: ["-h", "-p", "-I", "-H"],
};
