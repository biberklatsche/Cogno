import { CommandSpec } from "../../spec.types";

export const ESBUILD_FIG_SPEC: CommandSpec = {
    name: "esbuild",
    source: "fig",
    subcommands: [
        "--bundle",
        "--watch",
        "--outfile",
        "--outdir",
        "--platform",
        "--target",
        "--format",
        "--minify",
        "--sourcemap",
    ],
    subcommandOptions: {
        "--bundle": ["--outfile", "--outdir", "--platform", "--target", "--minify", "--sourcemap"],
    },
};
