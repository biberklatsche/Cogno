import { CommandSpec } from "../../spec.types";

export const SKAFFOLD_FIG_SPEC: CommandSpec = {
    name: "skaffold",
    source: "fig",
    subcommands: ["dev", "run", "build", "deploy", "render", "test", "delete", "diagnose"],
    subcommandOptions: {
        dev: ["--port-forward", "--tail", "--trigger", "--profile", "--default-repo"],
        run: ["--tail", "--profile", "--default-repo", "--cache-artifacts"],
        build: ["--profile", "--default-repo", "--cache-artifacts", "--push"],
    },
};
