import { CommandSpec } from "../../spec.types";

export const BUF_FIG_SPEC: CommandSpec = {
    name: "buf",
    source: "fig",
    subcommands: ["lint", "format", "breaking", "generate", "build", "dep", "push", "registry", "beta"],
    subcommandOptions: {
        lint: ["--path", "--config", "--error-format", "--timeout"],
        format: ["-w", "--exit-code", "--diff", "--config"],
        breaking: ["--against", "--config", "--path", "--error-format"],
        generate: ["--path", "--template", "--exclude-path", "--timeout"],
    },
};
