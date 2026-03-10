// completion spec for dotenv
// https://github.com/bkeepers/dotenv
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "dotenv",
    description: "Loads environment variables from .env",
    options: [
        {
            name: "-f",
            description: "List of env files to parse"
        },
        {
            name: ["-h", "--help"],
            description: "Display help"
        },
        {
            name: ["-v", "--version"],
            description: "Show version"
        },
        {
            name: ["-t", "--template"],
            description: "Create a template env file"
        }
    ]
};
export default completionSpec;
