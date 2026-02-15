import { CommandSpec } from "../../spec.types";

export const WEBPACK_FIG_SPEC: CommandSpec = {
    name: "webpack",
    source: "fig",
    subcommands: [
        "serve",
        "watch",
        "--config",
        "--mode",
        "--entry",
        "--output-path",
        "--env",
        "--progress",
        "--profile",
    ],
};

