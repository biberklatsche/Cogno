import { CommandSpec } from "../../spec.types";

export const GCLOUD_FIG_SPEC: CommandSpec = {
    name: "gcloud",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/gcloud.ts",
    subcommands: [
        "auth",
        "config",
        "compute",
        "container",
        "run",
        "functions",
        "sql",
        "pubsub",
        "projects",
        "services",
        "iam",
    ],
    subcommandOptions: {
        config: ["set", "get-value", "list", "configurations", "configurations activate"],
        compute: ["instances", "disks", "networks", "firewall-rules", "--project", "--zone", "--region"],
        run: ["deploy", "services", "revisions", "--region", "--platform", "--allow-unauthenticated", "--project"],
    },
};
