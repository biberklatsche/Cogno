import { CommandSpec } from "../../spec.types";

export const MONGO_FIG_SPEC: CommandSpec = {
    name: "mongo",
    source: "fig",
    subcommands: ["--host", "--port", "--username", "--password", "--authenticationDatabase", "--eval"],
};
