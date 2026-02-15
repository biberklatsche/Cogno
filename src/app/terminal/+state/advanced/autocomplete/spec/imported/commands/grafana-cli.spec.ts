import { CommandSpec } from "../../spec.types";

export const GRAFANA_CLI_FIG_SPEC: CommandSpec = {
    name: "grafana-cli",
    source: "fig",
    subcommands: ["plugins", "admin", "help", "--homepath", "--config", "--pluginsDir", "--debug"],
};
