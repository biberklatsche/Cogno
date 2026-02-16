import { CommandSpec } from "../../spec.types";

export const COSIGN_FIG_SPEC: CommandSpec = {
    name: "cosign",
    source: "fig",
    subcommands: ["sign", "verify", "attest", "verify-attestation", "generate-key-pair", "public-key", "initialize", "tree"],
    subcommandOptions: {
        sign: ["--key", "--recursive", "--yes", "--timeout", "--upload"],
        verify: ["--key", "--certificate-identity", "--certificate-oidc-issuer", "--insecure-ignore-tlog"],
        attest: ["--key", "--predicate", "--type", "--timeout"],
    },
};
