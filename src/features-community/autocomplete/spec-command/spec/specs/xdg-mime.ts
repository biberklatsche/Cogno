import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "xdg-mime",
    description: "Command line tool for querying information about file type handling and adding descriptions for new file types",
    subcommands: [
        {
            name: "query",
            description: "Returns information related to file types",
            args: {
                name: "filetype | default"
            }
        },
        {
            name: "default",
            description: "Ask the desktop environment to make application the default application for opening files of type mimetype",
            args: [
                {
                    name: "application"
                },
                {
                    name: "mimetype(s)"
                }
            ]
        },
        {
            name: "install",
            description: "Adds the file type descriptions provided in mimetypes-file to the desktop environment",
            options: [
                {
                    name: "--mode",
                    args: {
                        name: "mode"
                    }
                },
                {
                    name: "--novendor",
                    description: "Disables xdg-mime checks that the mimetypes-file to be installed has a proper vendor prefix"
                }
            ],
            args: {
                name: "mimetypes-file"
            }
        },
        {
            name: "uninstall",
            description: "Removes the file type descriptions provided in mimetypes-file and previously added with xdg-mime install from the desktop environment",
            options: [
                {
                    name: "--mode",
                    args: {
                        name: "mode"
                    }
                }
            ],
            args: {
                name: "mimetypes-file"
            }
        }
    ],
    options: [
        {
            name: "--help",
            description: "Show command synopsis"
        },
        {
            name: "--manual",
            description: "Show manual page"
        },
        {
            name: "--version",
            description: "Show the xdg-utils version information"
        }
    ]
};
export default completionSpec;
