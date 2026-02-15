import { CommandSpec } from "../../spec.types";

export const ANSIBLE_PLAYBOOK_FIG_SPEC: CommandSpec = {
    name: "ansible-playbook",
    source: "fig",
    subcommands: ["-i", "-l", "-t", "-e", "--check", "--diff", "--syntax-check", "--list-tasks"],
};
