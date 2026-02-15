import { CommandSpec } from "../../spec.types";

export const KO_FIG_SPEC: CommandSpec = {
    name: "ko",
    source: "fig",
    subcommands: ["apply", "build", "resolve", "publish", "login", "completion", "version"],
};
