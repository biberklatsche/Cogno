import { CommandSpec } from "../../spec.types";

export const TRIVY_FIG_SPEC: CommandSpec = {
    name: "trivy",
    source: "fig",
    subcommands: ["image", "fs", "repo", "config", "kubernetes", "sbom", "server", "plugin", "module"],
};
