import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "hack",
    description: "Commands to manage resources commonly used for student hacks",
    subcommands: [
        {
            name: "create",
            description: "Create resources commonly used for a student hack, including a website, database, and artificial intelligence",
            options: [
                {
                    name: ["--location", "-l"],
                    description: "Location. Values from: az account list-locations. You can configure the default location using az configure --defaults location=<location>",
                    args: { name: "location" }
                },
                {
                    name: ["--name", "-n"],
                    description: "Base name of resources; random charagers will be appended",
                    args: { name: "name" }
                },
                {
                    name: ["--runtime", "-r"],
                    description: "Runtime",
                    args: {
                        name: "runtime"
                    }
                },
                {
                    name: "--ai",
                    description: "Enable Azure Cognitive Services",
                    args: { name: "ai" }
                },
                {
                    name: ["--database", "-d"],
                    description: "Database type - { sql | mysql | cosmosdb }",
                    args: { name: "database" }
                }
            ]
        },
        {
            name: "show",
            description: "Display settings for created resources, including database name and password, Git url, and website url",
            options: [
                {
                    name: ["--name", "-n"],
                    description: "Name of the application",
                    args: { name: "name" }
                }
            ]
        }
    ]
};
export default completion;
