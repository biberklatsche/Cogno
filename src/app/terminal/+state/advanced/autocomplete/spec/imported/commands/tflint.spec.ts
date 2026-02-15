import { CommandSpec } from "../../spec.types";

export const TFLINT_FIG_SPEC: CommandSpec = {
    name: "tflint",
    source: "fig",
    subcommands: ["--init", "--recursive", "--filter", "--chdir", "--fix", "--format", "--enable-rule", "--disable-rule"],
};
