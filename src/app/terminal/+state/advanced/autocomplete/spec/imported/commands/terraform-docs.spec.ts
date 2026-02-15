import { CommandSpec } from "../../spec.types";

export const TERRAFORM_DOCS_FIG_SPEC: CommandSpec = {
    name: "terraform-docs",
    source: "fig",
    subcommands: ["markdown", "asciidoc", "json", "pretty", "tfvars", "yaml", "version", "completion"],
};
