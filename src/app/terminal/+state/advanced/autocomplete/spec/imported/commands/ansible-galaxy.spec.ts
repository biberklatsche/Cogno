import { CommandSpec } from "../../spec.types";

export const ANSIBLE_GALAXY_FIG_SPEC: CommandSpec = {
    name: "ansible-galaxy",
    source: "fig",
    subcommands: ["collection", "role", "install", "list", "search", "init", "remove"],
};
