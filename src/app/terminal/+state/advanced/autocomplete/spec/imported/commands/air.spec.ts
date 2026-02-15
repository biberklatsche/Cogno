import { CommandSpec } from "../../spec.types";

export const AIR_FIG_SPEC: CommandSpec = {
    name: "air",
    source: "fig",
    subcommands: ["-c", "--build.cmd", "--build.bin", "--build.include_dir", "--build.exclude_dir", "--tmp_dir"],
};
