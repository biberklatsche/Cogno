import type { CommandSpec, Generator } from "../spec.types";
const generators: Record<string, Generator> = {
    installedVersions: {
        script: ["tfenv", "list"],
        postProcess: function (out) {
            return out.split("\n").map((tfversion) => {
                return { name: tfversion, description: "Version" };
            });
        },
    },
    allVersions: {
        script: ["tfenv", "list-remote"],
        postProcess: function (out) {
            return out.split("\n").map(function (line) {
                return { name: line, type: "option" };
            });
        },
    },
};
const completionSpec: CommandSpec = {
    name: "tfenv",
    description: "Terraform version manager",
    subcommands: [
        {
            name: "install",
            description: "Install a specific version of Terraform",
            args: {
                name: "version",
                description: "Possible Terraform Version"
            }
        },
        {
            name: "use",
            description: "Switch to a version to use",
            args: {
                name: "version",
                description: "Installed Terraform Version"
            }
        },
        {
            name: "uninstall",
            description: "Uninstall a specific version of Terraform",
            args: {
                name: "version",
                description: "Installed Terraform Version"
            }
        },
        {
            name: "list",
            description: "List all installed versions"
        },
        {
            name: "list-remote",
            description: "List all installable versions"
        },
        {
            name: "version-name",
            description: "Print current version"
        },
        {
            name: "init",
            description: "Update environment to use tfenv correctly"
        }
    ],
    options: [
        {
            name: ["-v", "--version"],
            description: "View your current tfenv version"
        },
        {
            name: "--help",
            description: "View commands"
        }
    ]
};
export default completionSpec;
