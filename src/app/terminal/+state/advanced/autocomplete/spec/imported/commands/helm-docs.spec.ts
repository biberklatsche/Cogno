import { CommandSpec } from "../../spec.types";

export const HELM_DOCS_FIG_SPEC: CommandSpec = {
    name: "helm-docs",
    source: "fig",
    subcommands: ["--chart-search-root", "--template-files", "--output-file", "--sort-values-order", "--ignore-non-descriptions"],
};
