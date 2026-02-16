import { CommandSpec } from "../../spec.types";

export const SKOPEO_FIG_SPEC: CommandSpec = {
    name: "skopeo",
    source: "fig",
    subcommands: ["copy", "inspect", "delete", "list-tags", "login", "logout", "sync", "manifest-digest"],
    subcommandOptions: {
        copy: ["--all", "--format", "--src-creds", "--dest-creds", "--src-tls-verify", "--dest-tls-verify"],
        inspect: ["--raw", "--config", "--creds", "--tls-verify", "--retry-times"],
        sync: ["--src", "--dest", "--src-creds", "--dest-creds", "--scoped", "--all"],
    },
};
