import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "artifacts",
    description: "Manage Azure Artifacts",
    subcommands: [
        {
            name: "universal",
            description: "Manage Universal Packages",
            subcommands: [
                {
                    name: "download",
                    description: "Download a package",
                    options: [
                        {
                            name: "--feed",
                            description: "Name or ID of the feed",
                            args: { name: "feed" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the package, e.g. 'foo-package'",
                            args: { name: "name" }
                        },
                        {
                            name: "--path",
                            description: "Directory to place the package contents",
                            args: { name: "path" }
                        },
                        {
                            name: ["--version", "-v"],
                            description: "Version of the package, e.g. 1.0.0",
                            args: { name: "version" }
                        },
                        {
                            name: "--detect",
                            description: "Automatically detect organization",
                            args: { name: "detect" }
                        },
                        {
                            name: "--file-filter",
                            description: "Wildcard filter for file download",
                            args: { name: "file-filter" }
                        },
                        {
                            name: ["--organization", "--org"],
                            description: "Azure DevOps organization URL. You can configure the default organization using az devops configure -d organization=ORG_URL. Required if not configured as default or picked up via git config. Example: https://dev.azure.com/MyOrganizationName/",
                            args: { name: "organization" }
                        },
                        {
                            name: ["--project", "-p"],
                            description: "Name or ID of the project. You can configure the default project using az devops configure -d project=NAME_OR_ID. Required if not configured as default or picked up via git config",
                            args: { name: "project" }
                        },
                        {
                            name: "--scope",
                            description: "Scope of the feed: 'project' if the feed was created in a project, and 'organization' otherwise",
                            args: { name: "scope" }
                        }
                    ]
                },
                {
                    name: "publish",
                    description: "Publish a package to a feed",
                    options: [
                        {
                            name: "--feed",
                            description: "Name or ID of the feed",
                            args: { name: "feed" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "Name of the package, e.g. 'foo-package'",
                            args: { name: "name" }
                        },
                        {
                            name: "--path",
                            description: "Directory containing the package contents",
                            args: { name: "path" }
                        },
                        {
                            name: ["--version", "-v"],
                            description: "Version of the package, e.g. '1.0.0'",
                            args: { name: "version" }
                        },
                        {
                            name: ["--description", "-d"],
                            description: "Description of the package",
                            args: { name: "description" }
                        },
                        {
                            name: "--detect",
                            description: "Automatically detect organization",
                            args: { name: "detect" }
                        },
                        {
                            name: ["--organization", "--org"],
                            description: "Azure DevOps organization URL. You can configure the default organization using az devops configure -d organization=ORG_URL. Required if not configured as default or picked up via git config. Example: https://dev.azure.com/MyOrganizationName/",
                            args: { name: "organization" }
                        },
                        {
                            name: ["--project", "-p"],
                            description: "Name or ID of the project. You can configure the default project using az devops configure -d project=NAME_OR_ID. Required if not configured as default or picked up via git config",
                            args: { name: "project" }
                        },
                        {
                            name: "--scope",
                            description: "Scope of the feed: 'project' if the feed was created in a project, and 'organization' otherwise",
                            args: { name: "scope" }
                        }
                    ]
                }
            ]
        }
    ]
};
export default completion;
