import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "hostname",
    description: "Set or print name of current host system",
    options: [
        {
            name: "-f",
            description: "Include domain information in the printed name"
        },
        {
            name: "-s",
            description: "Trim off any domain information from the printed name"
        },
        {
            name: "-d",
            description: "Only print domain information"
        }
    ]
};
export default completionSpec;
