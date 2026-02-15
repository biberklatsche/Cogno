import { CommandSpec } from "../../spec.types";

export const MVN_FIG_SPEC: CommandSpec = {
    name: "mvn",
    source: "fig",
    subcommands: [
        "clean",
        "compile",
        "test",
        "package",
        "verify",
        "install",
        "deploy",
        "dependency:tree",
        "spring-boot:run",
    ],
};

