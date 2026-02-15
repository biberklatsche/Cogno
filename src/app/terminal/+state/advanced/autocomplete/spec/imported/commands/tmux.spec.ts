import { CommandSpec } from "../../spec.types";

export const TMUX_FIG_SPEC: CommandSpec = {
    name: "tmux",
    source: "fig",
    subcommands: [
        "new-session",
        "attach-session",
        "kill-session",
        "list-sessions",
        "new-window",
        "split-window",
        "select-pane",
        "resize-pane",
        "rename-window",
    ],
};

