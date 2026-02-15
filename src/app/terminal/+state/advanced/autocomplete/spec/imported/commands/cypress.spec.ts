import { CommandSpec } from "../../spec.types";

export const CYPRESS_FIG_SPEC: CommandSpec = {
    name: "cypress",
    source: "fig",
    subcommands: ["open", "run", "verify", "install", "cache", "info", "--browser", "--spec", "--headless"],
};
