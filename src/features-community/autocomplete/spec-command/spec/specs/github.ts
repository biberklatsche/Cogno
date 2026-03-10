import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "github",
    description: "Open a git repository in GitHub Desktop",
    options: [
        {
            name: "--help",
            description: "Show the help page for a command",
            args: {
                name: "command"
            }
        }
    ],
    subcommands: [
        {
            name: "clone",
            description: "Clone a repository",
            args: {
                name: "url|slug"
            },
            options: [
                {
                    name: ["--branch", "-b"],
                    description: "The branch to checkout after cloning",
                    args: { name: "branch" }
                }
            ]
        },
        {
            name: "open",
            description: "Open a git repository in GitHub Desktop",
            args: {
                name: "path"
            }
        },
        {
            name: "help",
            description: "Show the help page for a command",
            args: {
                name: "command"
            }
        }
    ]
};
export default completionSpec;
