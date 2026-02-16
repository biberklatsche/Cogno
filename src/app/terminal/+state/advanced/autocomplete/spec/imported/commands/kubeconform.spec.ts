import { CommandSpec } from "../../spec.types";

export const KUBECONFORM_FIG_SPEC: CommandSpec = {
    name: "kubeconform",
    source: "fig",
    subcommands: ["-strict", "-summary", "-verbose", "-output", "-schema-location", "-ignore-missing-schemas", "-kubernetes-version"],
    subcommandOptions: {
        "-strict": ["-summary", "-output", "-ignore-missing-schemas", "-schema-location", "-kubernetes-version"],
        "-output": ["json", "junit", "pretty", "tap", "text"],
    },
};
