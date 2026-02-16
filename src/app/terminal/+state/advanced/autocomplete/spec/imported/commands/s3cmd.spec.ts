import { CommandSpec } from "../../spec.types";

export const S3CMD_FIG_SPEC: CommandSpec = {
    name: "s3cmd",
    source: "fig",
    subcommands: ["ls", "mb", "rb", "put", "get", "sync", "del", "cp", "mv", "info"],
    subcommandOptions: {
        ls: ["--recursive", "--human-readable-sizes"],
        sync: ["--delete-removed", "--exclude", "--include", "--acl-public", "--storage-class"],
        put: ["--acl-public", "--storage-class", "--server-side-encryption", "--multipart-chunk-size-mb"],
        get: ["--force", "--continue-put", "--requester-pays"],
    },
};
