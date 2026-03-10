import type { CommandSpec, Suggestion } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "kubens",
    description: "Switch between Kubernetes-namespaces",
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for kubens"
        },
        {
            name: ["--current", "-c"],
            description: "Show current namespace"
        }
    ]
};
export default completionSpec;
