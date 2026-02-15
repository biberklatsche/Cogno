import { CommandSpec } from "../../spec.types";

export const PYTHON3_FIG_SPEC: CommandSpec = {
    name: "python3",
    source: "fig",
    subcommands: ["-m", "-c", "-V", "--version", "-i", "-u", "-O", "-B", "-X", "-W"],
};

