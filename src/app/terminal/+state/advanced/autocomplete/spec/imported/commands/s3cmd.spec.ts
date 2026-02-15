import { CommandSpec } from "../../spec.types";

export const S3CMD_FIG_SPEC: CommandSpec = {
    name: "s3cmd",
    source: "fig",
    subcommands: ["ls", "mb", "rb", "put", "get", "sync", "del", "cp", "mv", "info"],
};
