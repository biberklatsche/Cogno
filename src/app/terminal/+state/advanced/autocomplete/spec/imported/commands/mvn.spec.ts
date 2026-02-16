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
    subcommandOptions: {
        test: ["-Dtest=", "-DskipTests", "-P", "-pl", "-am"],
        clean: ["-DskipTests", "-P", "-pl", "-am"],
        package: ["-DskipTests", "-P", "-pl", "-am"],
        install: ["-DskipTests", "-P", "-pl", "-am"],
    },
};
