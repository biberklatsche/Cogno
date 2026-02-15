import { CommandSpec } from "../../spec.types";

export const TRUFFLEHOG_FIG_SPEC: CommandSpec = {
    name: "trufflehog",
    source: "fig",
    subcommands: ["git", "github", "gitlab", "filesystem", "s3", "gcs", "docker", "stdin", "version"],
};
