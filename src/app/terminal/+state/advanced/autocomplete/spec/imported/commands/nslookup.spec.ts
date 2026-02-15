import { CommandSpec } from "../../spec.types";

export const NSLOOKUP_FIG_SPEC: CommandSpec = {
    name: "nslookup",
    source: "fig",
    subcommands: ["-type=A", "-type=AAAA", "-type=MX", "-type=TXT", "-debug", "-timeout", "-retry"],
};
