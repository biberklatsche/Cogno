import { CommandSpec } from "../../spec.types";

export const GPG_FIG_SPEC: CommandSpec = {
    name: "gpg",
    source: "fig",
    subcommands: ["--encrypt", "--decrypt", "--sign", "--verify", "--armor", "--recipient", "--output", "--list-keys"],
};

