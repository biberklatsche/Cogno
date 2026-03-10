import type { CommandSpec, Suggestion } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "networkQuality",
    description: "Measure the different aspects of network quality",
    options: [
        {
            name: "-h",
            description: "Show help for networkQuality"
        },
        {
            name: "-c",
            description: "Produce computer readable output"
        },
        {
            name: "-s",
            description: "Run tests sequentially instead of in parallel"
        },
        {
            name: "-v",
            description: "Verbose output"
        },
        {
            name: "-C",
            description: "Use a custom configuration URL",
            args: {
                name: "URL"
            }
        },
        {
            name: "-I",
            description: "Bind test to interface",
            args: {
                name: "interface"
            }
        }
    ]
};
export default completionSpec;
