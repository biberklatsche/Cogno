import { CommandSpec } from "../../spec.types";

export const REGCTL_FIG_SPEC: CommandSpec = {
    name: "regctl",
    source: "fig",
    subcommands: ["artifact", "blob", "image", "index", "manifest", "registry", "repo", "tag", "version"],
    subcommandOptions: {
        image: ["copy", "digest", "export", "import", "inspect", "mod", "ratelimit"],
        manifest: ["get", "head", "put", "delete", "diff"],
        repo: ["ls", "set", "copy"],
    },
};
