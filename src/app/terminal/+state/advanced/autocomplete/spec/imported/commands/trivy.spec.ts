import { CommandSpec } from "../../spec.types";

export const TRIVY_FIG_SPEC: CommandSpec = {
    name: "trivy",
    source: "fig",
    subcommands: ["image", "fs", "repo", "config", "kubernetes", "sbom", "server", "plugin", "module"],
    subcommandOptions: {
        image: ["--severity", "--ignore-unfixed", "--scanners", "--format", "--exit-code", "--timeout"],
        fs: ["--severity", "--ignore-unfixed", "--scanners", "--format", "--exit-code", "--timeout"],
        config: ["--severity", "--misconfig-scanners", "--format", "--exit-code"],
        kubernetes: ["--severity", "--include-namespaces", "--exclude-namespaces", "--report", "--timeout"],
    },
};
