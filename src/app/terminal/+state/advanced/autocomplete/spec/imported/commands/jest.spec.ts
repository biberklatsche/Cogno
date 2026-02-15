import { CommandSpec } from "../../spec.types";

export const JEST_FIG_SPEC: CommandSpec = {
    name: "jest",
    source: "fig",
    subcommands: ["--watch", "--watchAll", "--runInBand", "--coverage", "--testNamePattern", "--testPathPattern", "--updateSnapshot"],
};
