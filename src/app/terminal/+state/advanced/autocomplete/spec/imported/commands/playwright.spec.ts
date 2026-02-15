import { CommandSpec } from "../../spec.types";

export const PLAYWRIGHT_FIG_SPEC: CommandSpec = {
    name: "playwright",
    source: "fig",
    subcommands: ["test", "show-report", "install", "codegen", "open", "--project", "--headed", "--debug"],
};
