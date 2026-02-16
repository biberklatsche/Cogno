import { CommandSpec } from "../../spec.types";

export const GORELEASER_FIG_SPEC: CommandSpec = {
    name: "goreleaser",
    source: "fig",
    subcommands: ["release", "build", "check", "changelog", "healthcheck", "init", "jsonschema", "publish", "continue"],
    subcommandOptions: {
        release: ["--clean", "--snapshot", "--skip", "--parallelism", "--timeout", "--config"],
        build: ["--snapshot", "--single-target", "--id", "--config"],
        check: ["--config", "--strict"],
    },
};
