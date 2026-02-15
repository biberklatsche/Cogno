import { CommandSpec } from "../../spec.types";

export const RUSTUP_FIG_SPEC: CommandSpec = {
    name: "rustup",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/rustup.ts",
    subcommands: ["toolchain", "target", "component", "override", "default", "update", "show", "run", "which"],
};

