import { CommandSpec } from "../../spec.types";

export const SKAFFOLD_FIG_SPEC: CommandSpec = {
    name: "skaffold",
    source: "fig",
    subcommands: ["dev", "run", "build", "deploy", "render", "test", "delete", "diagnose"],
};
