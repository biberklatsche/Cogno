import { CommandSpec } from "../../spec.types";

export const NERDCTL_FIG_SPEC: CommandSpec = {
    name: "nerdctl",
    source: "fig",
    subcommands: ["run", "build", "exec", "ps", "images", "pull", "push", "logs", "compose", "container"],
    subcommandOptions: {
        run: ["-it", "--rm", "-d", "-p", "-v", "--name", "--env", "--network"],
        build: ["-t", "-f", "--build-arg", "--no-cache", "--target", "--progress"],
        exec: ["-it", "--user", "--workdir", "--env"],
        logs: ["-f", "--tail", "--since", "--timestamps"],
        compose: ["up", "down", "build", "logs", "exec", "run", "pull", "push"],
    },
};
