// Author: Yavko
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "eleventy",
    description: "Eleventy is a simpler static site generator",
    options: [
        {
            description: "Show help message and exit",
            name: ["-h", "--help"]
        },
        {
            description: "Show program's version number and exit",
            name: ["-v", "--version"]
        },
        {
            description: "Don’t print all written files",
            name: "--quiet"
        },
        {
            description: "Wait for files to change and automatically rewrite",
            name: "--watch"
        },
        {
            description: "Don’t write any files",
            name: "--dryrun"
        },
        {
            description: "Input template files",
            name: "--input",
            args: {
                name: "Template File"
            }
        },
        {
            description: "Write HTML output to this folder",
            name: "--output"
        },
        {
            description: "Run web server on port and watch them too",
            name: "--serve"
        },
        {
            description: "Run Web Server on specified port",
            name: "--port",
            args: {
                name: "port"
            }
        },
        {
            description: "Whitelist only certain template types",
            name: "--formats",
            args: {
                name: "Template Names Separated by ,"
            }
        },
        {
            description: "Override the eleventy config file path",
            name: "--config",
            args: {
                name: "Config File"
            }
        },
        {
            description: "Change all url template filters to use this subdirectory",
            name: "--pathprefix",
            args: {
                name: "Subdirectory"
            }
        }
    ]
};
export default completionSpec;
