import { CommandSpec } from "../../spec.types";

export const DOPPLER_FIG_SPEC: CommandSpec = {
    name: "doppler",
    source: "fig",
    subcommands: ["setup", "configs", "secrets", "run", "me", "projects", "environments", "imports", "login"],
    subcommandOptions: {
        run: ["--", "--project", "--config", "--token", "--no-check-version"],
        secrets: ["get", "set", "download", "upload", "delete", "substitute"],
        configs: ["get", "create", "list", "tokens"],
        setup: ["--project", "--config", "--token", "--scope"],
    },
};
