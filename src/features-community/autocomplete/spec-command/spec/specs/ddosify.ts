import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "ddosify",
    description: "High-performance load testing tool, written in Golang",
    options: [
        {
            name: "-t",
            description: "Target website URL. Example: https://ddosify.com",
            args: {
                name: "URL"
            }
        },
        {
            name: "-n",
            description: "Total request count. Default: 100",
            args: {
                name: "RequestCount"
            }
        },
        {
            name: "-d",
            description: "Test duration in seconds. Default: 10",
            args: {
                name: "Duration"
            }
        },
        {
            name: "-l",
            description: "Type of the request. Default: linear",
            args: {
                name: "RequestType"
            }
        },
        {
            name: "-m",
            description: "HTTP Methods. Default: GET",
            args: {
                name: "HTTPMethod"
            }
        },
        {
            name: "-b",
            description: "Body for the request",
            args: {
                name: "Body"
            }
        },
        {
            name: "-a",
            description: "Basic authentication",
            args: {
                name: "BasicAuth"
            }
        },
        {
            name: "-h",
            description: "Headers of the request. You can provide multiple headers",
            isRepeatable: true,
            args: {
                name: "header"
            }
        },
        {
            name: "-T",
            description: "Timeout in seconds. Default: 5",
            args: {
                name: "Timeout"
            }
        },
        {
            name: "-P",
            description: "Proxy address",
            args: {
                name: "Proxy"
            }
        },
        {
            name: "-o",
            description: "Test result output format. Default: stdout",
            args: {
                name: "OutputFormat"
            }
        },
        {
            name: "--config",
            description: "Config file of the load test i.e example_ddosify_config.json",
            args: {
                name: "ConfigFile"
            }
        },
        {
            name: "--version",
            description: "Prints version, git commit, built date (utc)"
        },
        {
            name: "--debug",
            description: "Iterates the scenario once and prints curl-like verbose result"
        },
        {
            name: "--help",
            description: "Prints CLI flags"
        }
    ]
};
export default completionSpec;
