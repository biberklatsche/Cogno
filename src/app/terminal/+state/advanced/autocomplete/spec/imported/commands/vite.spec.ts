import { CommandSpec } from "../../spec.types";

export const VITE_FIG_SPEC: CommandSpec = {
    name: "vite",
    source: "fig",
    subcommands: ["build", "dev", "preview", "--host", "--port", "--config", "--mode", "--open", "--strictPort"],
    subcommandOptions: {
        dev: ["--host", "--port", "--open", "--strictPort"],
        build: ["--mode", "--watch", "--outDir", "--sourcemap"],
        preview: ["--host", "--port", "--open", "--strictPort"],
    },
};
