import type { ArgSpec, CommandSpec } from "../spec.types";
const icon = "https://remix.run/favicon-dark.1.png";
const dirArgument: ArgSpec = {
    name: "dir",
    description: "Represent the directory of the Remix application"
};
const completionSpec: CommandSpec = {
    name: "remix",
    description: "Remix CLI to start, build and export your application",
    options: [
        {
            name: "--help",
            description: "Output usage information"
        },
        {
            name: ["-v", "--version"],
            description: "Output the version number"
        }
    ],
    subcommands: [
        {
            name: "build",
            description: "Create an optimized production build of your application",
            args: dirArgument,
            options: [
                {
                    name: "--sourcemap",
                    description: "Enables production sourcemap"
                }
            ]
        },
        {
            name: "dev",
            description: "Start the application in development mode",
            args: dirArgument
        },
        {
            name: "setup",
            description: "Prepare node_modules/remix folder (after installation of packages)",
            args: dirArgument
        },
        {
            name: "routes",
            description: "Generate the route config of the application",
            args: dirArgument,
            options: [
                { name: "--json", description: "Print the route config as JSON" }
            ]
        }
    ]
};
export default completionSpec;
