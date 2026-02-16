import { CommandSpec } from "../../spec.types";

export const AWS_FIG_SPEC: CommandSpec = {
    name: "aws",
    source: "fig",
    sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/aws.ts",
    subcommands: [
        "configure",
        "s3",
        "ec2",
        "lambda",
        "iam",
        "sts",
        "cloudformation",
        "ecr",
        "ecs",
        "eks",
    ],
    options: ["--profile", "--region", "--output", "--query", "--no-cli-pager"],
    subcommandOptions: {
        s3: ["cp", "ls", "sync", "mv", "rm", "--recursive", "--exclude", "--include", "--profile", "--region"],
        ec2: ["describe-instances", "start-instances", "stop-instances", "--instance-ids", "--filters", "--profile", "--region"],
        lambda: ["invoke", "list-functions", "update-function-code", "--function-name", "--profile", "--region"],
    },
};
