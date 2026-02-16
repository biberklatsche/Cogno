import { CommandSpec } from "../../spec.types";

export const BUILDAH_FIG_SPEC: CommandSpec = {
    name: "buildah",
    source: "fig",
    subcommands: ["from", "run", "commit", "bud", "images", "push", "pull", "mount", "umount", "tag"],
    subcommandOptions: {
        from: ["--name", "--pull", "--platform", "--tls-verify", "--quiet"],
        run: ["--user", "--hostname", "--volume", "--workingdir", "--network"],
        commit: ["--format", "--rm", "--squash", "--timestamp", "--manifest"],
        bud: ["-f", "-t", "--build-arg", "--layers", "--no-cache", "--platform"],
    },
};
