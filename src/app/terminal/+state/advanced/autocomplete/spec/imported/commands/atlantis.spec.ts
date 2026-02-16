import { CommandSpec } from "../../spec.types";

export const ATLANTIS_FIG_SPEC: CommandSpec = {
    name: "atlantis",
    source: "fig",
    subcommands: ["server", "testdrive", "version", "help", "--config", "--repo-config", "--repo-whitelist"],
    subcommandOptions: {
        server: ["--config", "--repo-config", "--repo-whitelist", "--automerge", "--port"],
    },
};
