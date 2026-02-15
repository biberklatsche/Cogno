import { CommandSpec } from "../../spec.types";

export const NMAP_FIG_SPEC: CommandSpec = {
    name: "nmap",
    source: "fig",
    subcommands: ["-sV", "-sS", "-sU", "-p", "-Pn", "-A", "-O", "-T4", "--script"],
};
