import { CommandSpec } from "../../spec.types";

export const ANSIBLE_FIG_SPEC: CommandSpec = {
    name: "ansible",
    source: "fig",
    subcommands: ["all", "localhost", "--inventory", "--module-name", "--args", "--limit", "--check", "--diff"],
};

