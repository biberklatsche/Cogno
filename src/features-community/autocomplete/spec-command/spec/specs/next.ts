import type { ArgSpec, CommandSpec, OptionSpec } from "../spec.types";
const icon = "https://nextjs.org/static/favicon/favicon-16x16.png";
const hostPortOptions: OptionSpec[] = [
    {
        name: ["-p", "--port"],
        description: "A port number on which to start the application"
    },
    {
        name: ["-H", , "--hostname"],
        description: "Hostname on which to start the application"
    }
];
const dirArgument: ArgSpec = {
    name: "dir",
    description: "Represent the directory of the Next.js application"
};
const completionSpec: CommandSpec = {
    name: "next",
    description: "Next.js CLI to start, build and export your application",
    options: [
        {
            name: ["-h", "--help"],
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
                    name: "--profile",
                    description: "Enable production profiling"
                },
                {
                    name: "--debug",
                    description: "Enable more verbose build output"
                }
            ]
        },
        {
            name: "dev",
            description: "Start the application in development mode",
            args: dirArgument,
            options: hostPortOptions
        },
        {
            name: "start",
            description: "Start the application in production mode",
            args: dirArgument,
            options: hostPortOptions
        },
        {
            name: "export",
            description: "Exports the application for production deployment",
            args: dirArgument,
            options: [
                {
                    name: "-s",
                    description: "Do not print any messages to console"
                }
            ]
        },
        {
            name: "telemetry",
            description: "Allows you to control Next.js' telemetry collection",
            args: {
                name: "status",
                description: "Turn Next.js' telemetry collection on or off"
            }
        }
    ]
};
export default completionSpec;
