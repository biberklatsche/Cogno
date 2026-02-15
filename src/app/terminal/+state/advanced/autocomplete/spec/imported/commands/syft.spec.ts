import { CommandSpec } from "../../spec.types";

export const SYFT_FIG_SPEC: CommandSpec = {
    name: "syft",
    source: "fig",
    subcommands: ["scan", "packages", "convert", "attest", "version", "help", "-o", "--scope"],
};
