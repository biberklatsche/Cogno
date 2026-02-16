import { CommandSpec } from "../../spec.types";

export const SYFT_FIG_SPEC: CommandSpec = {
    name: "syft",
    source: "fig",
    subcommands: ["scan", "packages", "convert", "attest", "version", "help", "-o", "--scope"],
    subcommandOptions: {
        scan: ["-o", "--scope", "--exclude", "--select-catalogers"],
        packages: ["-o", "--scope", "--exclude", "--select-catalogers"],
        convert: ["-o", "--file", "--output"],
    },
};
