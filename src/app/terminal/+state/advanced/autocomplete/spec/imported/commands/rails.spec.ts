import { CommandSpec } from "../../spec.types";

export const RAILS_FIG_SPEC: CommandSpec = {
    name: "rails",
    source: "fig",
    subcommands: [
        "new",
        "server",
        "console",
        "db:migrate",
        "db:seed",
        "routes",
        "generate",
        "destroy",
        "test",
    ],
};

