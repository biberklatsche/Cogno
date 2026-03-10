import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
type VersionsJSON = {
    latest: string;
    versions: string[];
};
const completionSpec: CommandSpec = {
    name: "deployctl",
    description: "Command line tool for Deno Deploy",
    subcommands: [
        {
            name: "deploy",
            description: "Deploy a script with static files to Deno Deploy",
            args: {
                name: "entrypoint"
            },
            options: [
                {
                    name: "--exclude",
                    description: "Exclude files that match this pattern",
                    args: {
                        name: "pattern"
                    }
                },
                {
                    name: "--include",
                    description: "Only upload files that match this pattern",
                    args: {
                        name: "pattern"
                    }
                },
                {
                    name: "--no-static",
                    description: "Don't include the files in the CWD as static files"
                },
                {
                    name: "--prod",
                    description: "Create a production deployment (default is preview deployment)"
                },
                {
                    name: ["-p", "--project"],
                    description: "The project to deploy to",
                    args: {
                        name: "name"
                    }
                },
                {
                    name: "--token",
                    description: "The API token to use",
                    args: {
                        name: "token"
                    }
                }
            ]
        },
        {
            name: "upgrade",
            description: "Upgrade deployctl",
            args: {
                name: "version"
            }
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help"
        },
        {
            name: ["-V", "--version"],
            description: "Show the version"
        }
    ]
};
export default completionSpec;
