import { CommandSpec } from "../../spec.types";

export const GORELEASER_FIG_SPEC: CommandSpec = {
    name: "goreleaser",
    source: "fig",
    subcommands: ["release", "build", "check", "changelog", "healthcheck", "init", "jsonschema", "publish", "continue"],
};
