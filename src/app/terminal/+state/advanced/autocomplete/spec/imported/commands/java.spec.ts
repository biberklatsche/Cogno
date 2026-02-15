import { CommandSpec } from "../../spec.types";

export const JAVA_FIG_SPEC: CommandSpec = {
    name: "java",
    source: "fig",
    subcommands: ["-jar", "-cp", "-classpath", "-version", "--version", "-Xmx", "-Xms", "-D"],
};

