import { CommandSpec } from "../../spec.types";

export const HELMWAVE_FIG_SPEC: CommandSpec = {
    name: "helmwave",
    source: "fig",
    subcommands: ["build", "up", "down", "diff", "apply", "destroy", "status", "graph", "template"],
    subcommandOptions: {
        build: ["--file", "--template", "--values", "--set", "--skip-deps"],
        up: ["--yes", "--build", "--diff", "--kubedog", "--wait"],
        diff: ["--detailed-exitcode", "--build", "--context"],
        destroy: ["--yes", "--wait", "--timeout"],
    },
};
