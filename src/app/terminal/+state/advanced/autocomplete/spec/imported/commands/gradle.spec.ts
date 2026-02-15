import { CommandSpec } from "../../spec.types";

export const GRADLE_FIG_SPEC: CommandSpec = {
    name: "gradle",
    source: "fig",
    subcommands: ["build", "test", "clean", "assemble", "run", "tasks", "dependencies", "wrapper", "--scan"],
};

