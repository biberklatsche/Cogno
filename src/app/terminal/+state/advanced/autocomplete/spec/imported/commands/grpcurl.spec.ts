import { CommandSpec } from "../../spec.types";

export const GRPCURL_FIG_SPEC: CommandSpec = {
    name: "grpcurl",
    source: "fig",
    subcommands: ["list", "describe", "-d", "-H", "-plaintext", "-proto", "-import-path", "-cacert", "-cert", "-key"],
};
