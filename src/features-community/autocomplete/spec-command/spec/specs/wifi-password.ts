import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "wifi-password",
    description: "People ask you for the Wi-Fi password. Answer quickly. macOS only",
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help for wifi-password"
        },
        {
            name: ["--quiet", "-q"],
            description: "Only output the password"
        },
        {
            name: ["--version", "-V"],
            description: "Output version"
        }
    ]
};
export default completionSpec;
