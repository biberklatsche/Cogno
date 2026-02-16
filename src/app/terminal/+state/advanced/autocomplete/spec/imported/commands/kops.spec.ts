import { CommandSpec } from "../../spec.types";

export const KOPS_FIG_SPEC: CommandSpec = {
    name: "kops",
    source: "fig",
    subcommands: ["create", "update", "delete", "validate", "rolling-update", "replace", "export", "get", "toolbox"],
    subcommandOptions: {
        create: ["cluster", "instancegroup", "secret", "--name", "--state", "--yes"],
        update: ["cluster", "--name", "--state", "--yes", "--admin", "--target"],
        delete: ["cluster", "--name", "--state", "--yes"],
        validate: ["cluster", "--name", "--state", "--wait"],
    },
};
