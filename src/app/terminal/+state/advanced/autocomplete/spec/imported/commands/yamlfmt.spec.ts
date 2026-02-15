import { CommandSpec } from "../../spec.types";

export const YAMLFMT_FIG_SPEC: CommandSpec = {
    name: "yamlfmt",
    source: "fig",
    subcommands: ["-conf", "-quiet", "-lint", "-exclude", "-formatter", "-version"],
};
