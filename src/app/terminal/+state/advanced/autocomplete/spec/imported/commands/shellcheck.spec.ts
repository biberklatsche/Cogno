import { CommandSpec } from "../../spec.types";

export const SHELLCHECK_FIG_SPEC: CommandSpec = {
    name: "shellcheck",
    source: "fig",
    subcommands: ["-f", "-S", "-e", "-i", "-P", "-x", "--shell", "--wiki-link-count"],
};
