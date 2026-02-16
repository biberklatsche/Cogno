import { CommandSpec } from "../../spec.types";

export const LINKERD_FIG_SPEC: CommandSpec = {
    name: "linkerd",
    source: "fig",
    subcommands: ["install", "check", "upgrade", "inject", "viz", "multicluster", "jaeger", "completion"],
    subcommandOptions: {
        install: ["--crds", "--ignore-cluster", "--identity-issuer-certificate-file", "--set"],
        check: ["--proxy", "--pre", "--wait", "--namespace"],
        inject: ["--manual", "--proxy-log-level", "--ignore-cluster", "--skip-inbound-ports"],
    },
};
