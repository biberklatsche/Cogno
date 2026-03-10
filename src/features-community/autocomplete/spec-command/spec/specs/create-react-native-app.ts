import type { ArgSpec, CommandSpec } from "../spec.types";
const ICONS = {
    help: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/help.png",
    version: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/info.png",
    true: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/true.png",
    false: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/false.png",
    skip: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/skip.png",
    path: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/path.png",
    string: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/string.png",
    template: "https://raw.githubusercontent.com/expo/expo-cli/master/assets/fig/export.png",
    npm: "fig://icon?type=npm",
};
const boolArg: ArgSpec = {
    name: "boolean"
};
const completionSpec: CommandSpec = {
    name: "create-react-native-app",
    description: "Creates a new React Native project",
    options: [
        // template
        {
            name: "--template",
            description: "The name of a template from expo/examples or URL to a GitHub repo that contains an example",
            args: {
                name: "template"
            }
        },
        {
            name: "--template-path",
            description: "The path inside of a GitHub repo where the example lives",
            args: {
                name: "name"
            }
        },
        // bool
        {
            name: "--yes",
            description: "Use the default options for creating a project",
            args: boolArg
        },
        {
            name: "--no-install",
            description: "Skip installing npm packages or CocoaPods",
            args: boolArg
        },
        {
            name: "--use-npm",
            description: "Use npm to install dependencies. (default when Yarn is not installed)",
            args: boolArg
        },
        // Info
        {
            name: ["-h", "--help"],
            description: "Output usage information"
        },
        {
            name: ["-V", "--version"],
            description: "Output the version number"
        }
    ]
};
export default completionSpec;
