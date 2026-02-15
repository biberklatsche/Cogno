import { CommandSpec } from "../../spec.types";

export const WGET_FIG_SPEC: CommandSpec = {
    name: "wget",
    source: "fig",
    subcommands: ["-O", "-q", "-c", "-r", "-N", "--mirror", "--no-check-certificate", "--user", "--password"],
};

