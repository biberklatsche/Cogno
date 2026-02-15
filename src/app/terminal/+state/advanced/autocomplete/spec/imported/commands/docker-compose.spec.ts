import { CommandSpec } from "../../spec.types";

export const DOCKER_COMPOSE_FIG_SPEC: CommandSpec = {
    name: "docker-compose",
    source: "fig",
    subcommands: ["up", "down", "build", "pull", "push", "ps", "logs", "exec", "run", "config"],
};

