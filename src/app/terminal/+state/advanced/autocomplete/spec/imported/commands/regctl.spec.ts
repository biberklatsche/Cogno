import { CommandSpec } from "../../spec.types";

export const REGCTL_FIG_SPEC: CommandSpec = {
    name: "regctl",
    source: "fig",
    subcommands: ["artifact", "blob", "image", "index", "manifest", "registry", "repo", "tag", "version"],
};
