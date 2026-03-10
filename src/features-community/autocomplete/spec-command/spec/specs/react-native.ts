import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec, Generator } from "../spec.types";
const JS_ICON = "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_js.svg";
const GRADLE_ICON = "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_gradle.svg";
const APPLE_ICON = "https://developer.apple.com/library/archive/Resources/1282/Images/apple2.png";
const ANDROID_ICON = "https://www.android.com/static/images/fav/favicon.ico";
const getJsFilesAndFolders = filepaths({
    extensions: ["js"],
    editFileSuggestions: { icon: JS_ICON },
});
const workerGenerator = {
    script: ["sysctl", "-n", "hw.ncpu"],
    postProcess: (scriptOutput: string) => {
        return Array.from({ length: Number(scriptOutput) }, (_x, i) => ({
            name: `${i}`,
        }));
    },
};
const xcodeConfigGenerator = {
    script: ["bash", "-c", "xcodebuild -project ios/*.xcodeproj  -list -json"],
    postProcess: (scriptOutput: string) => {
        const configurations = JSON.parse(scriptOutput).project.configurations;
        return configurations.map((name) => ({ name }));
    },
};
const xcodeSchemeGenerator = {
    script: ["bash", "-c", "xcodebuild -project ios/*.xcodeproj  -list -json"],
    postProcess: (scriptOutput: string) => {
        const configurations = JSON.parse(scriptOutput).project.schemes;
        return configurations.map((name) => ({ name }));
    },
};
const androidGetDevicesGenerator = {
    script: ["adb", "devices"],
    postProcess: (scriptOutput: string) => {
        const devices = scriptOutput
            .split("\n")
            .filter((item) => !item.match(/^(List)|\*/))
            .filter(Boolean)
            .filter((item) => item.match(/device$/))
            .map((item) => item.split(/device/)[0].trim());
        return devices.map((item) => ({
            name: item,
            icon: ANDROID_ICON,
        }));
    },
};
type IosRecordType = {
    name: string;
};
const iosGetDevicesSimulatorGenerator = {
    script: ["xcrun", "simctl", "list", "--json", "devices", "available"],
    postProcess: (scriptOutput: string) => {
        const devices = JSON.parse(scriptOutput).devices;
        return Object.entries(devices)
            .map(([_, data]) => data)
            .reduce<Array<IosRecordType>>((a: Array<IosRecordType>, b: Array<IosRecordType>): Array<IosRecordType> => [...a, ...b], [])
            .map(({ name }: IosRecordType) => ({ name, icon: APPLE_ICON }));
    },
};
const iosGetDevicesGenerator = {
    script: ["xcrun", "xctrace", "list", "devices"],
    postProcess: (scriptOutput: string) => {
        const devices = scriptOutput
            .split("\n")
            .filter((item) => !item.match(/^=/))
            .filter(Boolean)
            .map((item) => item.split(/\([\w\d\-]+\)$/))
            .map(([name]) => ({ name: name.trim() }));
        return devices;
    },
};
const iosGetDevicesUdidGenerator = {
    script: ["xcrun", "xctrace", "list", "devices"],
    postProcess: (scriptOutput: string) => {
        const devices = scriptOutput
            .split("\n")
            .filter((item) => !item.match(/^=/))
            .filter(Boolean)
            .map((item) => item.split(" "))
            .map((items) => items[items.length - 1].trim().replace("(", "").replace(")", ""))
            .map((name) => ({ name }));
        return devices;
    },
};
const gradleTasksGenerator: Generator = {
    script: ["bash", "-c", "cd android/ && ./gradlew tasks"],
    postProcess: (scriptOutput: string) => {
        const tasks = scriptOutput
            .split("\n")
            .filter((item) => item.match(/^\w+ \- |\*/))
            .map((item) => item.split(" - "))
            .map(([name, description]) => ({ name, description }));
        return tasks;
    },
};
const completionSpec: CommandSpec = {
    name: "react-native",
    description: "Command line tools that ship with react-native in form of the @react-native-community/cli package",
    subcommands: [
        {
            description: "[EXPERIMENTAL] Diagnose and fix common Node.js, iOS, Android & React Native issues",
            name: "doctor",
            options: [
                {
                    name: "--fix",
                    description: "Attempt to fix all diagnosed issues"
                },
                {
                    name: "--contributor",
                    description: "Add healthchecks required to installations required for contributing to React Native"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Builds the javascript bundle for offline use",
            name: "bundle",
            options: [
                {
                    name: "--entry-file",
                    description: "Path to the root JS file, either absolute or relative to JS root",
                    args: {
                        name: "file"
                    }
                },
                {
                    name: "--platform",
                    description: 'Either "ios" or "android" (default: "ios")',
                    args: {
                        name: "platform"
                    }
                },
                {
                    name: "--transformer",
                    description: "Specify a custom transformer to be used",
                    args: {
                        name: "transformer"
                    }
                },
                {
                    name: "--dev",
                    description: "If false, warnings are disabled and the bundle is minified (default: true)",
                    args: {
                        name: "boolean"
                    }
                },
                {
                    name: "--minify",
                    description: "Allows overriding whether bundle is minified. This defaults to false if dev is true, and true if dev is false. Disabling minification can be useful for speeding up production builds for testing purposes",
                    args: {
                        name: "boolean"
                    }
                },
                {
                    name: "--bundle-output",
                    description: "File name where to store the resulting bundle, ex. /tmp/groups.bundle",
                    args: {
                        name: "bundle file"
                    }
                },
                {
                    name: "--bundle-encoding",
                    description: 'Encoding the bundle should be written in (https://nodejs.org/api/buffer.html#buffer_buffer). (default: "utf8")',
                    args: {
                        name: "encoding"
                    }
                },
                {
                    name: "--max-workers",
                    description: "Specifies the maximum number of workers the worker-pool will spawn for transforming files. This defaults to the number of the cores available on your machine",
                    args: {
                        name: "Number of workers"
                    }
                },
                {
                    name: "--sourcemap-output",
                    description: "File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map",
                    args: {
                        name: "sourcemap-output"
                    }
                },
                {
                    name: "--sourcemap-sources-root",
                    description: "Path to make sourcemap's sources entries relative to, ex. /root/dir",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: "--sourcemap-use-absolute-path",
                    description: "Report SourceMapURL using its full path"
                },
                {
                    name: "--assets-dest",
                    description: "Directory name where to store assets referenced in the bundle",
                    args: {
                        name: "directory"
                    }
                },
                {
                    name: "--unstable-transform-profile",
                    description: "Experimental, transform JS for a specific JS engine. Currently supported: hermes, hermes-canary, default",
                    args: {
                        name: "transform-profile"
                    }
                },
                {
                    name: "--reset-cache",
                    description: "Removes cached files"
                },
                {
                    name: "--read-global-cache",
                    description: "Try to fetch transformed JS code from the global cache, if configured"
                },
                {
                    name: "--config",
                    description: "Path to the CLI configuration file",
                    args: {
                        name: "string"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Initialize a new React Native project named <projectName> in a directory of the same name",
            name: "init",
            options: [
                {
                    name: "--version",
                    description: "Shortcut for `--template react-native@version`",
                    args: {
                        name: "version"
                    }
                },
                {
                    name: "--template",
                    description: "Uses a custom template. Valid arguments are the ones supported by `yarn add [package]` or `npm install [package]`, if you are using `--npm` option",
                    args: {
                        name: "template"
                    }
                },
                {
                    name: "--npm",
                    description: "Forces using npm for initialization"
                },
                {
                    name: "--directory",
                    description: "Uses a custom directory instead of `<projectName>`",
                    args: {
                        name: "string"
                    }
                },
                {
                    name: "--title",
                    description: "Uses a custom app title name for application",
                    args: {
                        name: "title"
                    }
                },
                {
                    name: "--skip-install",
                    description: "Skips dependencies installation step"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "projectName"
            }
        },
        {
            description: "Uninstall and unlink native dependencies",
            name: "uninstall",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "packageName"
            }
        },
        {
            description: "Starts the webserver",
            name: "start",
            options: [
                {
                    name: "--port",
                    description: "Port on which to listen to",
                    args: {
                        name: "free port"
                    }
                },
                {
                    name: "--host",
                    description: "Change the default host",
                    args: {
                        name: "new host"
                    }
                },
                {
                    name: "--projectRoot",
                    description: "Path to a custom project root",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--watchFolders",
                    description: "Specify any additional folders to be added to the watch list",
                    args: {
                        name: "folders"
                    }
                },
                {
                    name: "--assetPlugins",
                    description: "Specify any additional asset plugins to be used by the packager by full filepath",
                    args: {
                        name: "plugins"
                    }
                },
                {
                    name: "--sourceExts",
                    description: "Specify any additional source extensions to be used by the packager",
                    args: {
                        name: "sourceExts"
                    }
                },
                {
                    name: "--max-workers",
                    description: "Specifies the maximum number of workers the worker-pool will spawn for transforming files. This defaults to the number of the cores available on your machine",
                    args: {
                        name: "Number of workers"
                    }
                },
                {
                    name: "--transformer",
                    description: "Specify a custom transformer to be used",
                    args: {
                        name: "transformer"
                    }
                },
                {
                    name: ["--reset-cache", "--resetCache"],
                    description: "Removes cached files"
                },
                {
                    name: ["--custom-log-reporter-path", "--customLogReporterPath"],
                    description: "Path to a JavaScript file that exports a log reporter as a replacement for TerminalReporter",
                    args: {
                        name: "logFile"
                    }
                },
                {
                    name: "--verbose",
                    description: "Enables logging"
                },
                {
                    name: "--https",
                    description: "Enables https connections to the server"
                },
                {
                    name: "--key",
                    description: "Path to custom SSL key",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--cert",
                    description: "Path to custom SSL cert",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--config",
                    description: "Path to the CLI configuration file",
                    args: {
                        name: "string"
                    }
                },
                {
                    name: "--no-interactive",
                    description: "Disables interactive mode"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: 'Builds javascript as a "Random Access Module" bundle for offline use',
            name: "ram-bundle",
            options: [
                {
                    name: "--entry-file",
                    description: "Path to the root JS file, either absolute or relative to JS root",
                    args: {
                        name: "file"
                    }
                },
                {
                    name: "--platform",
                    description: 'Either "ios" or "android" (default: "ios")',
                    args: {
                        name: "platform"
                    }
                },
                {
                    name: "--transformer",
                    description: "Specify a custom transformer to be used",
                    args: {
                        name: "transformer"
                    }
                },
                {
                    name: "--dev",
                    description: "If false, warnings are disabled and the bundle is minified (default: true)",
                    args: {
                        name: "boolean"
                    }
                },
                {
                    name: "--minify",
                    description: "Allows overriding whether bundle is minified. This defaults to false if dev is true, and true if dev is false. Disabling minification can be useful for speeding up production builds for testing purposes",
                    args: {
                        name: "boolean"
                    }
                },
                {
                    name: "--bundle-output",
                    description: "File name where to store the resulting bundle, ex. /tmp/groups.bundle",
                    args: {
                        name: "output file"
                    }
                },
                {
                    name: "--bundle-encoding",
                    description: 'Encoding the bundle should be written in (https://nodejs.org/api/buffer.html#buffer_buffer). (default: "utf8")',
                    args: {
                        name: "encoding"
                    }
                },
                {
                    name: "--max-workers",
                    description: "Specifies the maximum number of workers the worker-pool will spawn for transforming files. This defaults to the number of the cores available on your machine",
                    args: {
                        name: "Number of workers"
                    }
                },
                {
                    name: "--sourcemap-output",
                    description: "File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map",
                    args: {
                        name: "sourcemap-output"
                    }
                },
                {
                    name: "--sourcemap-sources-root",
                    description: "Path to make sourcemap's sources entries relative to, ex. /root/dir",
                    args: {
                        name: "root"
                    }
                },
                {
                    name: "--sourcemap-use-absolute-path",
                    description: "Report SourceMapURL using its full path"
                },
                {
                    name: "--assets-dest",
                    description: "Directory name where to store assets referenced in the bundle",
                    args: {
                        name: "directory"
                    }
                },
                {
                    name: "--unstable-transform-profile",
                    description: "Experimental, transform JS for a specific JS engine. Currently supported: hermes, hermes-canary, default",
                    args: {
                        name: "transform-profile"
                    }
                },
                {
                    name: "--reset-cache",
                    description: "Removes cached files"
                },
                {
                    name: "--read-global-cache",
                    description: "Try to fetch transformed JS code from the global cache, if configured"
                },
                {
                    name: "--config",
                    description: "Path to the CLI configuration file",
                    args: {
                        name: "string"
                    }
                },
                {
                    name: "--indexed-ram-bundle",
                    description: 'Force the "Indexed RAM" bundle file format, even when building for android'
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Links assets and optionally native modules",
            name: "link",
            options: [
                {
                    name: "--platforms",
                    description: "Scope linking to specified platforms",
                    args: {
                        name: "list"
                    }
                },
                {
                    name: "--all",
                    description: "Link all native modules and assets"
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "packageName"
            }
        },
        {
            description: "Upgrade your app's template files to the specified or latest npm version using `rn-diff-purge` project. Only valid semver versions are allowed",
            name: "upgrade",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "version"
            }
        },
        {
            description: "Get relevant version info about OS, toolchain and libraries",
            name: "info",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Install and link native dependencies",
            name: "install",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "packageName"
            }
        },
        {
            description: "Print CLI configuration",
            name: "config",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Unlink native dependency",
            name: "unlink",
            options: [
                {
                    name: "--platforms",
                    description: "Scope unlinking to specified platforms",
                    args: {
                        name: "list"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "packageName"
            }
        },
        {
            description: "Starts iOS device syslog tail",
            name: "log-ios",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Pull and convert a Hermes tracing profile to Chrome tracing profile, then store it in the directory <destinationDir> of the local machine",
            name: "profile-hermes",
            options: [
                {
                    name: "--filename",
                    description: "File name of the profile to be downloaded, eg. sampling-profiler-trace8593107139682635366.cpuprofile",
                    args: {
                        name: "profile"
                    }
                },
                {
                    name: "--raw",
                    description: "Pulls the original Hermes tracing profile without any transformation"
                },
                {
                    name: "--sourcemap-path",
                    description: "The local path to your source map file, eg. /tmp/sourcemap.json",
                    args: {
                        name: "sourcemap-path"
                    }
                },
                {
                    name: "--generate-sourcemap",
                    description: "Generates the JS bundle and source map"
                },
                {
                    name: "--port",
                    description: 'Default: "8081"',
                    args: {
                        name: "free port"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ],
            args: {
                name: "destinationDir"
            }
        },
        {
            description: "Starts logkitty",
            name: "log-android",
            options: [
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Builds your app and starts it on a connected Android emulator or device",
            name: "run-android",
            options: [
                {
                    name: "--root",
                    description: '[DEPRECATED - root is discovered automatically] Override the root directory for the android build (which contains the android directory) (default: "")',
                    args: {
                        name: "root"
                    }
                },
                {
                    name: "--variant",
                    description: 'Specify your app\'s build variant (default: "debug")',
                    args: {
                        name: "variant"
                    }
                },
                {
                    name: "--appFolder",
                    description: '[DEPRECATED – use "project.android.appName" in react-native.config.js] Specify a different application folder name for the android source. If not, we assume is "app"',
                    args: {
                        name: "string"
                    }
                },
                {
                    name: "--appId",
                    description: 'Specify an applicationId to launch after build. If not specified, `package` from AndroidManifest.xml will be used. (default: "")',
                    args: {
                        name: "appId"
                    }
                },
                {
                    name: "--appIdSuffix",
                    description: 'Specify an applicationIdSuffix to launch after build. (default: "")',
                    args: {
                        name: "appIdSuffix"
                    }
                },
                {
                    name: "--main-activity",
                    description: 'Name of the activity to start (default: "MainActivity")',
                    args: {
                        name: "main activity"
                    }
                },
                {
                    name: "--deviceId",
                    description: 'Builds your app and starts it on a specific device/simulator with the given device id (listed by running "adb devices" on the command line)',
                    args: {
                        name: "deviceId"
                    }
                },
                {
                    name: "--no-packager",
                    description: "Do not launch packager while building"
                },
                {
                    name: "--port",
                    description: "Default: 8081",
                    args: {
                        name: "free port"
                    }
                },
                {
                    name: "--terminal",
                    description: 'Launches the Metro Bundler in a new window using the specified terminal path. (default: "Apple_Terminal")',
                    args: {
                        name: "terminal path"
                    }
                },
                {
                    name: "--tasks",
                    description: 'Run custom Gradle tasks. By default it\'s "installDebug"',
                    args: {
                        name: "task list"
                    }
                },
                {
                    name: "--no-jetifier",
                    description: 'Do not run "jetifier" – the AndroidX transition tool. By default it runs before Gradle to ease working with libraries that don\'t support AndroidX yet. See more at: https://www.npmjs.com/package/jetifier'
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        },
        {
            description: "Builds your app and starts it on iOS simulator",
            name: "run-ios",
            options: [
                {
                    name: "--simulator",
                    description: 'Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone 6 (10.0)" (default: "iPhone 12")',
                    args: {
                        name: "simulator"
                    }
                },
                {
                    name: "--configuration",
                    description: 'Explicitly set the scheme configuration to use (default: "Debug")',
                    args: {
                        name: "config scheme"
                    }
                },
                {
                    name: "--scheme",
                    description: "Explicitly set Xcode scheme to use",
                    args: {
                        name: "scheme"
                    }
                },
                {
                    name: "--project-path",
                    description: 'Path relative to project root where the Xcode project (.xcodeproj) lives. (default: "ios")',
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--device",
                    description: "Explicitly set device to use by name",
                    args: {
                        name: "device name"
                    }
                },
                {
                    name: "--udid",
                    description: "Explicitly set device to use by udid",
                    args: {
                        name: "udid"
                    }
                },
                {
                    name: "--no-packager",
                    description: "Do not launch packager while building"
                },
                {
                    name: "--verbose",
                    description: "Do not use xcpretty even if installed"
                },
                {
                    name: "--port",
                    description: "Default: 8081",
                    args: {
                        name: "free port"
                    }
                },
                {
                    name: "--terminal",
                    description: 'Launches the Metro Bundler in a new window using the specified terminal path. (default: "Apple_Terminal")',
                    args: {
                        name: "terminal path"
                    }
                },
                {
                    name: ["-h", "--help"],
                    description: "Output usage information"
                }
            ]
        }
    ],
    options: [
        {
            name: "--version",
            description: "Print CLI version"
        },
        {
            name: "--verbose",
            description: "Increase logging verbosity"
        },
        {
            name: ["-h", "--help"],
            description: "Output usage information"
        }
    ]
};
export default completionSpec;
