import { CommandSpec } from "../../spec.types";

export const DOCKER_COMPOSE_FIG_SPEC: CommandSpec = {
    name: "docker-compose",
    source: "fig",
    subcommands: ["up", "down", "build", "pull", "push", "ps", "logs", "exec", "run", "config"],
    subcommandOptions: {
        up: ["-d", "--build", "--force-recreate", "--remove-orphans", "--wait"],
        down: ["-v", "--remove-orphans", "--rmi", "--timeout"],
        build: ["--pull", "--no-cache", "--build-arg", "--progress"],
        logs: ["-f", "--tail", "--timestamps", "--no-color"],
        exec: ["-T", "-e", "-u", "-w"],
        run: ["--rm", "-e", "-T", "-u", "-w", "--service-ports"],
    },
};
