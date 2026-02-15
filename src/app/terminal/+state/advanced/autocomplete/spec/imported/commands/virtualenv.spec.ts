import { CommandSpec } from "../../spec.types";

export const VIRTUALENV_FIG_SPEC: CommandSpec = {
    name: "virtualenv",
    source: "fig",
    subcommands: ["--python", "--system-site-packages", "--clear", "--upgrade", "--prompt", "--seed"],
};
