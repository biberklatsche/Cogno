import { CommandSpec } from "../../spec.types";

export const AGE_FIG_SPEC: CommandSpec = {
    name: "age",
    source: "fig",
    subcommands: ["-e", "-d", "-r", "-R", "-i", "-o", "-a", "--armor", "--passphrase"],
};

