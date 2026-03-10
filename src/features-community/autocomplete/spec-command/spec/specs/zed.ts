import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "zed",
    description: "A lightning-fast, collaborative code editor written in Rust",
    options: [
        {
            name: ["-h", "--help"],
            description: "Print help information"
        },
        {
            name: ["-v", "--version"],
            description: "Print Zed's version and the app path"
        },
        {
            name: ["-w", "--wait"],
            description: "Wait for all of the given paths to be closed before exiting"
        },
        {
            name: ["-b", "--bundle-path"],
            description: "Custom Zed.app path",
            args: {
                name: "bundle_path"
            }
        }
    ]
};
export default completionSpec;
