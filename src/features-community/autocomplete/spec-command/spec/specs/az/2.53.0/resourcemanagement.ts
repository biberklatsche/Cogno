import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "resourcemanagement",
    description: "Resourcemanagement CLI command group",
    subcommands: [
        {
            name: "private-link",
            description: "Resourcemanagement private-link management on a resource",
            subcommands: [
                {
                    name: "create",
                    description: "Create a resource management group private link",
                    options: [
                        {
                            name: ["--location", "-l"],
                            description: "The region to create the resource management private link",
                            args: { name: "location" }
                        },
                        {
                            name: ["--name", "-n"],
                            description: "The name of the resource management private link",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "The name of the resource group",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Delete a resource management private link",
                    options: [
                        {
                            name: ["--name", "-n"],
                            description: "The name of the resource management private link",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "The name of the resource group",
                            args: { name: "resource-group" }
                        },
                        {
                            name: ["--yes", "-y"],
                            description: "Do not prompt for confirmation"
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Get all the resource management private links at scope",
                    options: [
                        {
                            name: ["--resource-group", "-g"],
                            description: "The name of the resource group",
                            args: { name: "resource-group" }
                        }
                    ]
                },
                {
                    name: "show",
                    description: "Get resource management private",
                    options: [
                        {
                            name: ["--name", "-n"],
                            description: "The name of the resource management private link",
                            args: { name: "name" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "The name of the resource group",
                            args: { name: "resource-group" }
                        }
                    ]
                }
            ]
        }
    ]
};
export default completion;
