import { CommandSpec } from "../../spec.types";

export const HTOP_FIG_SPEC: CommandSpec = {
    name: "htop",
    source: "fig",
    subcommands: ["--sort-key", "--tree", "--delay", "--pid", "--user", "--readonly", "--version"],
};
