import { CommandSpec } from "../../spec.types";

export const HTTP_FIG_SPEC: CommandSpec = {
    name: "http",
    source: "fig",
    subcommands: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "--form", "--json"],
};
