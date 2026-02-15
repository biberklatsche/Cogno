import { CommandSpec } from "../../spec.types";

export const PYTEST_FIG_SPEC: CommandSpec = {
    name: "pytest",
    source: "fig",
    subcommands: ["-k", "-m", "-q", "-x", "-s", "-vv", "--lf", "--ff", "--maxfail", "--cov", "--durations"],
};

