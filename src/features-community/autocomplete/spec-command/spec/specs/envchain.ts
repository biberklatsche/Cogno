import type { CommandSpec, Generator } from "../spec.types";
const namespaces: Generator = {
    script: ["envchain", "--list"],
    postProcess: (output) => {
        return Array.from(new Set(output.split("\n"))).map((namespace) => {
            return {
                name: namespace,
                description: `NAMESPACE ${namespace}`,
            };
        });
    },
};
const completionSpec: CommandSpec = {
    name: "envchain",
    description: "Set environment variables with macOS keychain or D-Bus secret service",
    subcommands: [
        {
            name: ["-s", "--set"],
            description: "Add keychain item of environment variable +ENV+ for namespace +NAMESPACE+",
            args: [
                {
                    name: "NAMESPACE"
                },
                {
                    name: "ENV"
                }
            ],
            options: [
                {
                    name: ["-n", "--noecho"],
                    description: "Do not echo user input"
                },
                {
                    name: ["-p", "--require-passphrase"],
                    description: "Always ask for keychain passphrase"
                },
                {
                    name: ["-P", "--no-require-passphrase"],
                    description: "Do not ask for keychain passphrase"
                }
            ]
        },
        {
            name: ["-l", "--list"],
            description: "List namespaces that have been created"
        }
    ]
};
export default completionSpec;
