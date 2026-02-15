import { CommandSpec } from "../../spec.types";

export const MONGOSH_FIG_SPEC: CommandSpec = {
    name: "mongosh",
    source: "fig",
    subcommands: ["--host", "--port", "--username", "--password", "--authenticationDatabase", "--file", "--eval"],
};

