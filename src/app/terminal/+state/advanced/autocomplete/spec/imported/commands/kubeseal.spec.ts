import { CommandSpec } from "../../spec.types";

export const KUBESEAL_FIG_SPEC: CommandSpec = {
    name: "kubeseal",
    source: "fig",
    subcommands: ["--cert", "--controller-name", "--controller-namespace", "--fetch-cert", "--format", "--raw", "--scope", "--re-encrypt"],
};
