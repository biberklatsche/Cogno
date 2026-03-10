import type { CommandSpec } from "../../../spec.types";
const completion: CommandSpec = {
    name: "cli-translator",
    description: "Translate ARM template or REST API to CLI scripts",
    subcommands: [
        {
            name: "arm",
            description: "Translate ARM template to CLI scripts(Currently only support Compute, Network and Storage)",
            subcommands: [
                {
                    name: "translate",
                    description: "Translate ARM template to CLI scripts(Currently only support Compute, Network and Storage)",
                    options: [
                        {
                            name: "--parameters",
                            description: "The local path or url of parameters.json file",
                            args: { name: "parameters" }
                        },
                        {
                            name: ["--resource-group", "-g"],
                            description: "Name of resource group. You can configure the default group using az configure --defaults group=<name>",
                            args: { name: "resource-group" }
                        },
                        {
                            name: "--template",
                            description: "The local path or url of template.json file",
                            args: { name: "template" }
                        },
                        {
                            name: "--target-subscription",
                            description: "The target subscription id. If omit, the current subscription id will be used",
                            args: { name: "target-subscription" }
                        }
                    ]
                }
            ]
        }
    ]
};
export default completion;
