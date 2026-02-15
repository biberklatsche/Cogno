import { CommandSpec } from "../../spec.types";

export const OPENSSL_FIG_SPEC: CommandSpec = {
    name: "openssl",
    source: "fig",
    subcommands: ["x509", "req", "rsa", "genrsa", "s_client", "dgst", "enc", "rand", "version"],
};
