import { CommandSpec } from "../../spec.types";

export const CHAMBER_FIG_SPEC: CommandSpec = {
    name: "chamber",
    source: "fig",
    subcommands: ["list", "read", "write", "delete", "exec", "import", "export", "version"],
    subcommandOptions: {
        exec: ["--preserve-environment", "--path", "--quiet", "--", "bash", "zsh"],
        list: ["--format", "--exact-match"],
        write: ["--type", "--overwrite"],
    },
};
