import { CommandSpec } from "../../spec.types";

export const SOPS_FIG_SPEC: CommandSpec = {
    name: "sops",
    source: "fig",
    subcommands: ["-e", "-d", "-i", "--encrypt", "--decrypt", "--rotate", "--set", "--extract", "--config"],
};

