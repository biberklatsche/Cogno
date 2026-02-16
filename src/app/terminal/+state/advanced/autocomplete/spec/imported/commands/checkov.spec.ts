import { CommandSpec } from "../../spec.types";

export const CHECKOV_FIG_SPEC: CommandSpec = {
    name: "checkov",
    source: "fig",
    subcommands: ["-d", "-f", "--framework", "--check", "--skip-check", "--soft-fail", "-o", "--compact"],
    subcommandOptions: {
        "-d": ["--framework", "--check", "--skip-check", "--soft-fail", "-o"],
        "-f": ["--framework", "--check", "--skip-check", "--soft-fail", "-o"],
        "--framework": ["terraform", "kubernetes", "dockerfile", "secrets", "sca_package", "github_actions"],
    },
};
