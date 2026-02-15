import { CommandSpec } from "../../spec.types";

export const COMMITLINT_FIG_SPEC: CommandSpec = {
    name: "commitlint",
    source: "fig",
    subcommands: ["--edit", "--from", "--to", "--last", "--config", "--strict", "--verbose", "--print-config"],
};
