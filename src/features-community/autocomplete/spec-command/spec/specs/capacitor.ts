import type { CommandSpec, Generator, Suggestion } from "../spec.types";
const platforms: Suggestion[] = [
    { name: "android", icon: "fig://icon?type=android" },
    { name: "ios", icon: "fig://icon?type=apple" }
];
function isPlatform(value: string): value is "ios" | "android" {
    return value === "ios" || value === "android";
}
const targetGenerator: Generator = {
    cache: {
        ttl: 1000 * 60, // Only caches targets for one minute, in case a new device is connected
    },
    custom: async (tokens, executeShellCommand) => {
        const [cliName, command, platform] = tokens;
        if (!isPlatform(platform)) {
            return [];
        }
        const { stdout } = await executeShellCommand({
            command: "npx",
            args: ["capacitor", "run", platform, "--list"],
        });
        return stdout
            .trim()
            .split("\n")
            .slice(2) // Ignore output header lines
            .map((s) => {
            const [name, api, targetId] = s.replace(/\s\s+/g, "|").split("|");
            return {
                name: targetId,
                displayName: `${name} ${api}`,
                icon: "📱",
            };
        });
    },
};
const completionSpec: CommandSpec = {
    name: "capacitor",
    description: "The Capacitor command-line interface (CLI) tool is used to develop Capacitor apps",
    subcommands: [
        {
            name: "add",
            description: "Add a native platform project to your app",
            args: {
                name: "platform"
            }
        },
        {
            name: "copy",
            description: "Copy the web app build and Capacitor configuration file into the native platform project. Run this each time you make changes to your web app or change a configuration value",
            args: {
                name: "platform"
            }
        },
        {
            name: "ls",
            description: "List all installed Cordova and Capacitor plugins",
            args: {
                name: "platform"
            }
        },
        {
            name: "open",
            description: "Opens the native project workspace in the specified native IDE (Xcode for iOS, Android Studio for Android)",
            args: {
                name: "platform"
            }
        },
        {
            name: "run",
            description: "Opens the native project workspace in the specified native IDE (Xcode for iOS, Android Studio for Android)",
            args: {
                name: "platform"
            },
            options: [
                {
                    name: "--list",
                    description: "Print a list of target devices available to the given platform"
                },
                {
                    name: "--target",
                    description: "Run on a specific target device",
                    args: {
                        name: "target"
                    }
                }
            ]
        },
        {
            name: "sync",
            description: "This command runs copy and then update",
            args: {
                name: "platform"
            },
            options: [
                {
                    name: "--deployment",
                    description: "Podfile.lock won't be deleted and pod install will use --deployment option"
                },
                {
                    name: "--inline",
                    description: "After syncing, all JS source maps will be inlined allowing for debugging an Android Web View in Chromium based browsers"
                }
            ]
        },
        {
            name: "update",
            description: "Updates the native plugins and dependencies referenced in package.json",
            args: {
                name: "platform"
            },
            options: [
                {
                    name: "--deployment",
                    description: "Podfile.lock won't be deleted and pod install will use --deployment option"
                }
            ]
        }
    ],
    options: [
        {
            name: ["--help", "-h"],
            description: "Output usage information. Can be used with individual commands too"
        },
        {
            name: ["--version", "-V"],
            description: "Output the version number"
        }
    ]
};
export default completionSpec;
