import type { ArgSpec, CommandSpec } from "../spec.types";
const modeArg: ArgSpec = {
    name: "mode"
};
const frontendArg: ArgSpec = {
    name: "frontend"
};
const completionSpec: CommandSpec = {
    name: "do-release-upgrade",
    description: "Upgrade Ubuntu to latest release",
    options: [
        {
            name: ["-h", "--help"],
            description: "Show help message and exit"
        },
        {
            name: ["-d", "--devel-release"],
            description: "If using the latest supported release, upgrade to the development release"
        },
        {
            name: ["-p", "--proposed"],
            description: "Try upgrading to the latest release using the upgrader from Ubuntu-proposed"
        },
        {
            name: "-m",
            description: "Run in a special upgrade mode",
            args: modeArg
        },
        {
            name: "--mode",
            description: "Run in a special upgrade mode",
            args: modeArg
        },
        {
            name: "-f",
            description: "Run the specified frontend",
            args: frontendArg
        },
        {
            name: "--frontend",
            description: "Run the specified frontend",
            args: frontendArg
        }
    ]
};
export default completionSpec;
