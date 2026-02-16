import { CommandSpec } from "../../spec.types";

export const TASK_FIG_SPEC: CommandSpec = {
    name: "task",
    source: "fig",
    subcommands: ["--list", "--list-all", "--summary", "--watch", "--dry", "--parallel", "--silent", "completion"],
    subcommandOptions: {
        "--list": ["--json", "--sort", "--silent"],
        "--watch": ["--interval", "--silent", "--status"],
        "--dry": ["--summary", "--verbose"],
    },
};
