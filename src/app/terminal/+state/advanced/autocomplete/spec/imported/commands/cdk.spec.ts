import { CommandSpec } from "../../spec.types";

export const CDK_FIG_SPEC: CommandSpec = {
    name: "cdk",
    source: "fig",
    subcommands: ["deploy", "diff", "synth", "destroy", "list", "bootstrap", "doctor", "watch"],
    subcommandOptions: {
        deploy: ["--all", "--require-approval", "--profile", "--context", "--hotswap"],
        diff: ["--profile", "--context", "--security-only", "--strict"],
        synth: ["--profile", "--context", "--quiet", "--validation"],
    },
};
