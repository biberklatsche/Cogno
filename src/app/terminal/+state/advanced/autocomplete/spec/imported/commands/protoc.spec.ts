import { CommandSpec } from "../../spec.types";

export const PROTOC_FIG_SPEC: CommandSpec = {
    name: "protoc",
    source: "fig",
    subcommands: ["--proto_path", "--descriptor_set_out", "--include_imports", "--include_source_info", "--encode", "--decode", "--plugin"],
};
