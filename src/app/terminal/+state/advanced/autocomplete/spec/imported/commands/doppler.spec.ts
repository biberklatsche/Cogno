import { CommandSpec } from "../../spec.types";

export const DOPPLER_FIG_SPEC: CommandSpec = {
    name: "doppler",
    source: "fig",
    subcommands: ["setup", "configs", "secrets", "run", "me", "projects", "environments", "imports", "login"],
};
