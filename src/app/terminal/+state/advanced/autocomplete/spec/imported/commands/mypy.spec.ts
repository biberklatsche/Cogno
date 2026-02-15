import { CommandSpec } from "../../spec.types";

export const MYPY_FIG_SPEC: CommandSpec = {
    name: "mypy",
    source: "fig",
    subcommands: ["--strict", "--config-file", "--ignore-missing-imports", "--python-version", "--warn-unused-ignores", "--show-error-codes"],
};
