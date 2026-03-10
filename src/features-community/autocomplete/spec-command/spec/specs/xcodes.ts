import type { CommandSpec, Generator } from "../spec.types";
const processXcodeList = (out: string, tokens: string[]) => out
    .split("\n")
    .reverse()
    .map((line) => ({
    name: line.slice(0, line.indexOf(" (")),
    icon: line.includes("Selected")
        ? "⭐️"
        : line.includes("Installed")
            ? "🔨"
            : tokens.includes("select") || tokens.includes("uninstall")
                ? "🔨"
                : "⬇️",
    description: line.slice(line.indexOf("(")).replace(/[\(\)]/g, ""),
}));
const allXcodes: Generator = {
    script: ["xcodes", "list"],
    postProcess: processXcodeList,
};
const installedXcodes: Generator = {
    script: ["xcodes", "installed"],
    postProcess: processXcodeList,
};
const completionSpec: CommandSpec = {
    name: "xcodes",
    description: "Manage the Xcode versions installed on your Mac",
    subcommands: [
        {
            name: "help",
            args: {
                name: "command"
            }
        },
        {
            name: "download",
            description: "Download a specific version of Xcode",
            options: [
                {
                    name: "--latest",
                    description: "Update and then install the latest non-prerelease version available"
                },
                {
                    name: "--latest-prerelease",
                    description: "Update and then install the latest prerelease version available, including GM seeds and GMs"
                },
                {
                    name: "--aria2",
                    description: "The path to an aria2 executable. Searches $PATH by default",
                    args: { name: "aria2" }
                },
                {
                    name: "--no-aria2",
                    description: "Don't use aria2 to download Xcode, even if it's available"
                },
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                {
                    name: "--data-source",
                    description: "The data source for available Xcode versions. (default: xcodereleases)",
                    args: { name: "dataSource" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ],
            args: {
                name: "version",
                description: "The version to install"
            }
        },
        {
            name: "install",
            description: "Download and install a specific version of Xcode",
            options: [
                {
                    name: "--path",
                    description: "Local path to Xcode.xip",
                    args: { name: "path" }
                },
                {
                    name: "--latest",
                    description: "Update and then install the latest non-prerelease version available"
                },
                {
                    name: "--latest-prerelease",
                    description: "Update and then install the latest prerelease version available, including GM seeds and GMs"
                },
                {
                    name: "--aria2",
                    description: "The path to an aria2 executable. Searches $PATH by default",
                    args: { name: "aria2" }
                },
                {
                    name: "--no-aria2",
                    description: "Don't use aria2 to download Xcode, even if it's available"
                },
                {
                    name: "--experimental-unxip",
                    description: "Use the experimental unxip functionality. May speed up unarchiving by up to 2-3x"
                },
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                {
                    name: "--data-source",
                    description: "The data source for available Xcode versions. (default: xcodereleases)",
                    args: { name: "dataSource" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ],
            args: {
                name: "version",
                description: "The version to install"
            }
        },
        {
            name: "installed",
            description: "List the versions of Xcode that are installed",
            options: [
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ]
        },
        {
            name: "list",
            description: "List all versions of Xcode available to install",
            options: [
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                {
                    name: "--data-source",
                    description: "The data source for available Xcode versions. (default: xcodereleases)",
                    args: { name: "dataSource" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ]
        },
        {
            name: "select",
            description: "Change the selected Xcode",
            options: [
                {
                    name: ["-p", "--print-path"],
                    description: "Print the path of the selected Xcode"
                },
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ],
            args: {
                name: "version-or-path",
                description: "Version or path of Xcode to select"
            }
        },
        {
            name: "uninstall",
            description: "Uninstall a version of Xcode",
            args: {
                name: "version"
            },
            options: [
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ]
        },
        {
            name: "update",
            description: "Update the list of available versions of Xcode",
            options: [
                {
                    name: "--directory",
                    description: "The directory where your Xcodes are installed. Defaults to /Applications",
                    args: { name: "directory" }
                },
                {
                    name: "--data-source",
                    description: "The data source for available Xcode versions. (default: xcodereleases)",
                    args: { name: "dataSource" }
                },
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ]
        },
        {
            name: "version",
            description: "Print the version number of xcodes itself",
            options: [
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" },
                {
                    name: ["--help", "-h"],
                    description: "Show help information"
                }
            ]
        },
        {
            name: "signout",
            description: "Clears the stored username and password",
            options: [
                { name: "--color", description: "Color the output" },
                { name: "--no-color", description: "Do not color the output" }
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Show help information"
        }
    ]
};
export default completionSpec;
