import { CommandSpec } from "../../spec.types";

export const DOCKER_FIG_SPEC: CommandSpec = {
    name: "docker",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/docker.ts",
    subcommands: [
        "build",
        "run",
        "ps",
        "images",
        "exec",
        "logs",
        "pull",
        "push",
        "compose",
        "rm",
        "rmi",
        "stop",
        "start",
    ],
    subcommandOptions: {
        run: ["-it", "--rm", "-d", "-p", "-v", "--name", "--env", "--network"],
        build: ["-t", "-f", "--build-arg", "--no-cache", "--target"],
        exec: ["-it", "--user", "--workdir", "--env"],
        logs: ["-f", "--tail", "--since", "--timestamps"],
        compose: ["up", "down", "build", "logs", "exec", "run", "pull", "push"],
    },
};
