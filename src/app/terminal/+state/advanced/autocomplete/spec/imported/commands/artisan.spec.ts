import { CommandSpec } from "../../spec.types";

export const ARTISAN_FIG_SPEC: CommandSpec = {
    name: "artisan",
    source: "fig",
    subcommands: [
        "serve",
        "migrate",
        "migrate:fresh",
        "db:seed",
        "route:list",
        "queue:work",
        "cache:clear",
        "config:cache",
        "test",
    ],
};

