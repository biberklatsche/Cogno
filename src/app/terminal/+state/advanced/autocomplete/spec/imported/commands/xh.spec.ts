import { CommandSpec } from "../../spec.types";

export const XH_FIG_SPEC: CommandSpec = {
    name: "xh",
    source: "fig",
    subcommands: ["--json", "--form", "--raw", "--download", "--follow", "--timeout", "--auth", "--offline"],
};
