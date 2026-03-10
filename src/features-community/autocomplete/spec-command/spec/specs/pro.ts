import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "pro",
    description: "Manage Ubuntu Pro services from Canonical",
    subcommands: [
        {
            name: "attach",
            description: "Connect an Ubuntu Pro support contract to this machine",
            options: [
                {
                    name: "--no-auto-enable",
                    description: "Disable  the  automatic enablement of recommended entitlements"
                },
                {
                    name: "--attach-config",
                    description: "Provide a file with configuration options",
                    args: {
                        name: "file path"
                    }
                }
            ],
            args: {
                name: "token",
                description: "Auth token. Not required if specified in --attach-config file"
            }
        },
        {
            name: "collect-logs",
            description: "Create a tarball with all relevant logs and debug data",
            options: [
                {
                    name: ["-o", "--output"],
                    description: "Path for tarball. Uses ua_logs.tar.gz in current directory if not specified",
                    args: {
                        name: "file"
                    }
                }
            ]
        },
        {
            name: "detach",
            description: "Remove Ubuntu Pro from this machine"
        },
        {
            name: "disable",
            description: "Disable this machine's access to an Ubuntu Pro service",
            args: {
                name: "service"
            }
        },
        {
            name: "enable",
            description: "Activate and configure this machine's access to an Ubuntu Pro service",
            args: {
                name: "service"
            }
        },
        {
            name: "fix",
            description: "Fix a CVE or USN on the  system  by  upgrading  the  appropriate package(s)",
            args: {
                name: "security issue"
            }
        },
        {
            name: "refresh",
            description: "Refresh contract and service details from Canonical"
        },
        {
            name: "security-status",
            description: "Show  security updates for packages in the system, including all available ESM related content"
        },
        {
            name: "status",
            description: "Report current status of Ubuntu Pro services on system",
            options: [
                {
                    name: "--format",
                    description: "Output format"
                },
                {
                    name: "--simulate-with-token",
                    args: {
                        name: "token"
                    }
                },
                {
                    name: "--all",
                    description: "Include beta and unavailable services"
                }
            ]
        }
    ]
};
export default completionSpec;
