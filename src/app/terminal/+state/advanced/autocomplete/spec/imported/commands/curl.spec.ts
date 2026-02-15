import { CommandSpec } from "../../spec.types";

export const CURL_FIG_SPEC: CommandSpec = {
    name: "curl",
    source: "fig",
    subcommands: ["-X", "-H", "-d", "-F", "-I", "-L", "-o", "-u", "-s", "-k", "--retry", "--compressed"],
};

