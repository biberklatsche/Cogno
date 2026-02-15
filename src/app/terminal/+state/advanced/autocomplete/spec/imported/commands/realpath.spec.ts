import { CommandSpec } from "../../spec.types";

export const REALPATH_FIG_SPEC: CommandSpec = {
    name: "realpath",
    source: "fig",
    subcommands: ["-e", "-m", "-L", "-P", "--relative-to", "--relative-base", "-z"],
};
