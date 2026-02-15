import { CommandSpec } from "../../spec.types";

export const VITE_FIG_SPEC: CommandSpec = {
    name: "vite",
    source: "fig",
    subcommands: ["build", "dev", "preview", "--host", "--port", "--config", "--mode", "--open", "--strictPort"],
};

