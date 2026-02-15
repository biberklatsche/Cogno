import { CommandSpec } from "../../spec.types";

export const PYTHON_FIG_SPEC: CommandSpec = {
    name: "python",
    source: "fig",
    subcommands: ["-m", "-c", "-V", "--version", "-i", "-u", "-O", "-B", "-X", "-W"],
};

