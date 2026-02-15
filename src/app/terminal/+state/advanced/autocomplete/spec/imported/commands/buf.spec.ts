import { CommandSpec } from "../../spec.types";

export const BUF_FIG_SPEC: CommandSpec = {
    name: "buf",
    source: "fig",
    subcommands: ["lint", "format", "breaking", "generate", "build", "dep", "push", "registry", "beta"],
};
