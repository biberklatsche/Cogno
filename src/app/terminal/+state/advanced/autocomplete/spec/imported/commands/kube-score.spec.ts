import { CommandSpec } from "../../spec.types";

export const KUBE_SCORE_FIG_SPEC: CommandSpec = {
    name: "kube-score",
    source: "fig",
    subcommands: ["score", "version", "help", "--output-format", "--ignore-test", "--enable-optional-test"],
};
