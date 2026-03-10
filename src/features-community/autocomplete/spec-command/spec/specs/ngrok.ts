import type { CommandSpec, OptionSpec } from "../spec.types";
const defaultNgrokOptions: Array<OptionSpec> = [
    {
        description: "Path to log file, 'stdout', 'stderr' or 'false'",
        name: ["--log", "-log"],
        args: {
            name: "value"
        }
    },
    {
        description: "Log record format: 'term', 'logfmt', 'json'",
        name: ["--log-format", "-log-format"]
    },
    {
        description: "Logging level",
        name: ["--log-level", "-log-level"],
        args: {
            name: "level"
        }
    }
];
const authTokenOption: OptionSpec = {
    description: "Ngrok.com authtoken identifying a user",
    name: ["--authtoken", "-authtoken"],
    args: {
        name: "authtoken"
    }
};
const regionOption: OptionSpec = {
    description: "Ngrok server region [us, eu, au, ap, sa, jp, in] (default: us)",
    name: ["--region", "-region"]
};
const configOptions: OptionSpec = {
    description: "Path to config files; they are merged if multiple",
    name: ["--config", "-config"],
    args: {
        name: "config file"
    }
};
const subdomainOption: OptionSpec = {
    description: "Host tunnel on a custom subdomain",
    name: ["--subdomain", "-subdomain"],
    args: {
        name: "subdomain"
    }
};
const hostOption: OptionSpec = {
    description: "Host tunnel on custom hostname (requires DNS CNAME)",
    name: ["--hostname", "-hostname"],
    args: {
        name: "hostname"
    }
};
const completionSpec: CommandSpec = {
    name: "ngrok",
    description: "Tunnel local ports to public URLs and inspect traffic",
    subcommands: [
        {
            name: "help",
            description: "Shows a list of commands or help for one command",
            args: {
                name: "command"
            }
        },
        {
            name: "http",
            description: "Start an HTTP tunnel",
            args: {
                name: "host"
            },
            options: [
                ...defaultNgrokOptions,
                configOptions,
                regionOption,
                authTokenOption,
                hostOption,
                subdomainOption,
                {
                    description: "Enforce basic auth on tunnel endpoint, 'user:password'",
                    name: ["--auth", "-auth"],
                    args: {
                        name: "user:password"
                    }
                },
                {
                    description: "Listen for http, https or both: true/false/both",
                    name: ["--bind-tls", "-bind-tls"],
                    args: {
                        name: "true/false/both"
                    }
                },
                {
                    description: "Set Host header; if 'rewrite' use local address hostname",
                    name: ["--host-header", "-host-header"]
                },
                {
                    description: "Enable/disable http introspection",
                    name: ["--introspection", "-introspection"]
                }
            ]
        },
        {
            name: "authtoken",
            args: {
                name: "authtoken"
            },
            description: "Save authtoken to configuration file",
            options: [...defaultNgrokOptions, configOptions]
        },
        {
            name: "credits",
            description: "Prints author and licensing information"
        },
        {
            name: "start",
            description: "Start tunnels by name from the configuration file",
            args: {
                name: "tunnels"
            },
            options: [
                ...defaultNgrokOptions,
                configOptions,
                regionOption,
                authTokenOption,
                {
                    name: ["--all", "-all"],
                    description: "Start all tunnels in the configuration file"
                },
                {
                    name: ["--none", "-none"],
                    description: "Start running no tunnels"
                }
            ]
        },
        {
            name: "tcp",
            description: "Start a TCP tunnel",
            args: {
                name: "port"
            },
            options: [
                ...defaultNgrokOptions,
                configOptions,
                authTokenOption,
                regionOption,
                {
                    name: ["--remote-addr", "-remote-addr"],
                    description: "Bind remote address (requires you reserve an address)",
                    args: {
                        name: "remote address"
                    }
                }
            ]
        },
        {
            name: "tls",
            description: "Start a TLS tunnel",
            args: {
                name: "port"
            },
            options: [
                ...defaultNgrokOptions,
                configOptions,
                authTokenOption,
                regionOption,
                hostOption,
                subdomainOption,
                {
                    name: ["--client-cas", "-client-cas"],
                    args: {
                        name: "certificate"
                    }
                },
                {
                    name: ["--crt", "-crt"],
                    args: {
                        name: "certificate"
                    }
                },
                {
                    name: ["--key", "-key"],
                    args: {
                        name: "certificate"
                    }
                }
            ]
        },
        {
            name: "update",
            description: "Update ngrok to the latest version",
            options: [
                ...defaultNgrokOptions,
                {
                    name: ["--channel", "-channel"],
                    description: "Update channel (stable, beta)",
                    args: {
                        name: "channel"
                    }
                }
            ]
        },
        {
            name: "version",
            description: "Print the version string"
        }
    ]
};
export default completionSpec;
