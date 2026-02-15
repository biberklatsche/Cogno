import { CommandSpec } from "../../spec.types";

export const YAMLLINT_FIG_SPEC: CommandSpec = {
    name: "yamllint",
    source: "fig",
    subcommands: ["-c", "-d", "-f", "-s", "--no-warnings", "--strict"],
};
