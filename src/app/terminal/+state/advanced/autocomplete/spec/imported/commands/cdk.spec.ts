import { CommandSpec } from "../../spec.types";

export const CDK_FIG_SPEC: CommandSpec = {
    name: "cdk",
    source: "fig",
    subcommands: ["deploy", "diff", "synth", "destroy", "list", "bootstrap", "doctor", "watch"],
};
